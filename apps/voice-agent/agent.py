"""
LiveKit Voice AI Agent
음성 대화가 가능한 AI 에이전트 (STT + LLM + TTS)
"""

import asyncio
import logging
import os
import io
import time
import json
import numpy as np
from dotenv import load_dotenv

from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
)
from livekit.plugins import silero
from faster_whisper import WhisperModel
import edge_tts

from llm import get_default_provider, ChatMessage, LLMProvider

load_dotenv()

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("voice-agent")

# 설정
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
TTS_VOICE = os.getenv("TTS_VOICE", "ko-KR-SunHiNeural")  # 한국어 여성 음성

# 전역 모델
_whisper_model = None
_llm_provider: LLMProvider = None


def get_whisper_model():
    """Whisper 모델 싱글톤"""
    global _whisper_model
    if _whisper_model is None:
        logger.info(f"Loading Whisper model: {WHISPER_MODEL_SIZE}")
        _whisper_model = WhisperModel(
            WHISPER_MODEL_SIZE,
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE_TYPE
        )
        logger.info("Whisper model loaded")
    return _whisper_model


def get_llm_provider() -> LLMProvider:
    """LLM Provider 싱글톤"""
    global _llm_provider
    if _llm_provider is None:
        _llm_provider = get_default_provider()
        logger.info(f"LLM provider initialized: {_llm_provider.get_provider_type()}, model: {_llm_provider.get_model_name()}")
    return _llm_provider


def log_metric(event: str, duration_ms: float, **kwargs):
    """메트릭 로그 출력 (Grafana 파싱용)"""
    metric = {
        "event": event,
        "duration_ms": round(duration_ms, 2),
        "timestamp": time.time(),
        **kwargs
    }
    logger.info(f"METRIC: {json.dumps(metric)}")


async def transcribe_audio(audio_frames: list) -> tuple[str, float]:
    """오디오 → 텍스트 (STT), 변환 시간 반환"""
    if not audio_frames:
        return "", 0.0

    model = get_whisper_model()
    start_time = time.time()

    # 오디오 프레임을 numpy로 변환
    audio_data = []
    for frame in audio_frames:
        frame_data = np.frombuffer(frame.data, dtype=np.int16)
        audio_data.append(frame_data)

    if not audio_data:
        return "", 0.0

    combined = np.concatenate(audio_data)
    audio_float = combined.astype(np.float32) / 32768.0
    audio_duration_sec = len(audio_float) / 16000  # 16kHz 기준

    # Whisper로 음성 인식
    loop = asyncio.get_event_loop()
    segments, info = await loop.run_in_executor(
        None,
        lambda: model.transcribe(audio_float, language="ko", beam_size=5, vad_filter=True)
    )

    text = " ".join([seg.text.strip() for seg in segments])

    duration_ms = (time.time() - start_time) * 1000
    log_metric(
        "stt_transcription",
        duration_ms,
        model=WHISPER_MODEL_SIZE,
        audio_duration_sec=round(audio_duration_sec, 2),
        text_length=len(text),
        language=info.language if hasattr(info, 'language') else "ko"
    )

    return text, duration_ms


async def get_llm_response(user_message: str, conversation_history: list) -> tuple[str, float]:
    """LLM 응답 생성, 응답 시간 반환"""
    provider = get_llm_provider()
    start_time = time.time()

    # 시스템 프롬프트
    system_prompt = """당신은 친절하고 도움이 되는 AI 어시스턴트입니다.
사용자와 음성으로 대화하고 있습니다.
짧고 자연스러운 대화체로 응답하세요.
한국어로 응답하세요."""

    messages = [ChatMessage(role="system", content=system_prompt)]
    for msg in conversation_history:
        messages.append(ChatMessage(role=msg["role"], content=msg["content"]))
    messages.append(ChatMessage(role="user", content=user_message))

    try:
        response = await provider.chat(messages)
        duration_ms = (time.time() - start_time) * 1000

        log_metric(
            "llm_response",
            duration_ms,
            provider=provider.get_provider_type(),
            model=provider.get_model_name(),
            input_length=len(user_message),
            output_length=len(response.content),
            history_length=len(conversation_history)
        )

        return response.content, duration_ms
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        log_metric(
            "llm_error",
            duration_ms,
            provider=provider.get_provider_type(),
            model=provider.get_model_name(),
            error=str(e)
        )
        logger.error(f"LLM error: {e}")
        return "죄송합니다, 응답을 생성하는 데 문제가 발생했습니다.", duration_ms


async def text_to_speech(text: str) -> tuple[bytes, float]:
    """텍스트 → 음성 (TTS), 생성 시간 반환"""
    start_time = time.time()
    try:
        communicate = edge_tts.Communicate(text, TTS_VOICE)
        audio_data = b""

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]

        duration_ms = (time.time() - start_time) * 1000
        log_metric(
            "tts_synthesis",
            duration_ms,
            voice=TTS_VOICE,
            text_length=len(text),
            audio_bytes=len(audio_data)
        )

        return audio_data, duration_ms
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        log_metric(
            "tts_error",
            duration_ms,
            voice=TTS_VOICE,
            error=str(e)
        )
        logger.error(f"TTS error: {e}")
        return b"", duration_ms


async def entrypoint(ctx: JobContext):
    """Agent 진입점"""

    logger.info(f"Voice Agent connecting to room: {ctx.room.name}")

    # Whisper 모델 로드
    get_whisper_model()

    # LLM Provider 초기화
    get_llm_provider()

    # 방 연결
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    logger.info(f"Connected to room: {ctx.room.name}")

    # VAD 설정
    vad = silero.VAD.load()

    # 오디오 소스 생성 (TTS 출력용)
    audio_source = rtc.AudioSource(24000, 1)  # 24kHz mono
    track = rtc.LocalAudioTrack.create_audio_track("agent-voice", audio_source)

    # 트랙 발행 옵션
    options = rtc.TrackPublishOptions()
    options.source = rtc.TrackSource.SOURCE_MICROPHONE

    # 트랙 발행
    await ctx.room.local_participant.publish_track(track, options)
    logger.info("Published audio track for TTS output")

    # 참가자별 대화 처리
    @ctx.room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.TrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return

        logger.info(f"Processing audio from: {participant.identity}")

        asyncio.create_task(
            handle_conversation(ctx, vad, track, participant, audio_source)
        )


async def handle_conversation(
    ctx: JobContext,
    vad: silero.VAD,
    track: rtc.Track,
    participant: rtc.RemoteParticipant,
    audio_source: rtc.AudioSource,
):
    """음성 대화 처리 루프"""

    audio_stream = rtc.AudioStream(track)
    vad_stream = vad.stream()

    speech_frames = []
    is_speaking = False
    conversation_history = []

    async def process_audio():
        nonlocal is_speaking, speech_frames

        async for event in audio_stream:
            frame = event.frame
            vad_stream.push_frame(frame)

            if is_speaking:
                speech_frames.append(frame)

    async def process_vad():
        nonlocal is_speaking, speech_frames, conversation_history

        async for event in vad_stream:
            if event.type == silero.VADEventType.START_OF_SPEECH:
                logger.debug(f"Speech started: {participant.identity}")
                is_speaking = True
                speech_frames = []

            elif event.type == silero.VADEventType.END_OF_SPEECH:
                logger.debug(f"Speech ended: {participant.identity}")
                is_speaking = False

                if not speech_frames:
                    continue

                frames_to_process = speech_frames.copy()
                speech_frames = []

                # 전체 파이프라인 시작
                pipeline_start = time.time()

                # 1. STT: 음성 → 텍스트
                user_text, stt_duration = await transcribe_audio(frames_to_process)
                if not user_text.strip():
                    continue

                logger.info(f"[{participant.identity}] User: {user_text}")

                # 2. LLM: 응답 생성
                ai_response, llm_duration = await get_llm_response(user_text, conversation_history)
                logger.info(f"[{participant.identity}] AI: {ai_response}")

                # 대화 기록 업데이트
                conversation_history.append({"role": "user", "content": user_text})
                conversation_history.append({"role": "assistant", "content": ai_response})

                # 최근 10개 대화만 유지
                if len(conversation_history) > 20:
                    conversation_history = conversation_history[-20:]

                # 3. TTS: 텍스트 → 음성
                audio_data, tts_duration = await text_to_speech(ai_response)

                # 전체 파이프라인 메트릭
                pipeline_duration = (time.time() - pipeline_start) * 1000
                log_metric(
                    "pipeline_complete",
                    pipeline_duration,
                    participant=participant.identity,
                    stt_ms=round(stt_duration, 2),
                    llm_ms=round(llm_duration, 2),
                    tts_ms=round(tts_duration, 2)
                )

                if audio_data:
                    await play_audio(audio_source, audio_data)

    await asyncio.gather(
        process_audio(),
        process_vad(),
    )


async def play_audio(audio_source: rtc.AudioSource, audio_data: bytes):
    """MP3 오디오를 LiveKit으로 스트리밍"""
    try:
        # edge-tts는 MP3를 출력하므로 변환 필요
        # 간단한 구현을 위해 pydub 사용 (추후 개선 가능)
        from pydub import AudioSegment

        audio = AudioSegment.from_mp3(io.BytesIO(audio_data))
        audio = audio.set_frame_rate(24000).set_channels(1)

        # PCM 데이터로 변환
        pcm_data = np.array(audio.get_array_of_samples(), dtype=np.int16)

        # 프레임 단위로 전송 (20ms = 480 samples at 24kHz)
        frame_size = 480
        for i in range(0, len(pcm_data), frame_size):
            chunk = pcm_data[i:i + frame_size]
            if len(chunk) < frame_size:
                chunk = np.pad(chunk, (0, frame_size - len(chunk)))

            frame = rtc.AudioFrame.create(24000, 1, frame_size)
            frame_data = np.frombuffer(frame.data, dtype=np.int16)
            np.copyto(frame_data, chunk)

            await audio_source.capture_frame(frame)
            await asyncio.sleep(0.02)  # 20ms

    except ImportError:
        logger.error("pydub not installed. Run: pip install pydub")
    except Exception as e:
        logger.error(f"Audio playback error: {e}")


def prewarm(proc: JobProcess):
    """사전 준비"""
    logger.info("Prewarming Voice Agent...")
    get_whisper_model()
    get_llm_provider()
    silero.VAD.load()
    logger.info("Voice Agent prewarmed")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )
