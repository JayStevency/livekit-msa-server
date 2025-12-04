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
    vad as agents_vad,
)
from livekit.plugins import silero
from faster_whisper import WhisperModel
import edge_tts

from llm import get_default_provider, ChatMessage, LLMProvider

load_dotenv()

# 로깅 설정
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("voice-agent")
logger.setLevel(logging.DEBUG)

# 설정
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
TTS_VOICE = os.getenv("TTS_VOICE", "ko-KR-SunHiNeural")  # 한국어 여성 음성

# Turn Detection 설정
TURN_DETECTION_SILENCE_MS = int(os.getenv("TURN_DETECTION_SILENCE_MS", "800"))  # 침묵 후 턴 종료 (ms)
TURN_DETECTION_MIN_SPEECH_MS = int(os.getenv("TURN_DETECTION_MIN_SPEECH_MS", "300"))  # 최소 발화 길이 (ms)
TURN_DETECTION_PREFIX_PADDING_MS = int(os.getenv("TURN_DETECTION_PREFIX_PADDING_MS", "300"))  # 발화 시작 전 포함 (ms)
INTERRUPT_THRESHOLD_MS = int(os.getenv("INTERRUPT_THRESHOLD_MS", "500"))  # 인터럽트 감지 임계값 (ms)

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
    # numpy 타입을 Python 기본 타입으로 변환
    sanitized_kwargs = {}
    for k, v in kwargs.items():
        if hasattr(v, 'item'):  # numpy scalar (float32, int64 등)
            sanitized_kwargs[k] = v.item()
        else:
            sanitized_kwargs[k] = v

    metric = {
        "event": event,
        "duration_ms": round(float(duration_ms), 2),
        "timestamp": time.time(),
        **sanitized_kwargs
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
    source_sample_rate = 48000  # LiveKit 기본 샘플레이트

    for frame in audio_frames:
        # 프레임에서 샘플레이트 정보 가져오기
        if hasattr(frame, 'sample_rate') and frame.sample_rate > 0:
            source_sample_rate = frame.sample_rate

        # AudioFrame의 data를 int16으로 변환
        # LiveKit AudioFrame.data는 bytes (int16 little-endian)
        frame_data = np.frombuffer(frame.data, dtype=np.int16)
        audio_data.append(frame_data)

    if not audio_data:
        return "", 0.0

    combined = np.concatenate(audio_data)

    # 디버그 로그
    logger.debug(f"Audio frames: {len(audio_frames)}, combined samples: {len(combined)}, sample_rate: {source_sample_rate}")

    # 오디오가 너무 짧으면 스킵
    if len(combined) < source_sample_rate * 0.3:  # 0.3초 미만
        logger.debug(f"Audio too short: {len(combined)} samples")
        return "", 0.0

    # Whisper는 16kHz mono를 기대함 - 리샘플링 필요
    target_sample_rate = 16000
    if source_sample_rate != target_sample_rate:
        # 간단한 리샘플링 (scipy 없이)
        ratio = target_sample_rate / source_sample_rate
        new_length = int(len(combined) * ratio)
        indices = np.linspace(0, len(combined) - 1, new_length).astype(int)
        combined = combined[indices]
        logger.debug(f"Resampled: {source_sample_rate}Hz -> {target_sample_rate}Hz, samples: {new_length}")

    audio_float = combined.astype(np.float32) / 32768.0
    audio_duration_sec = len(audio_float) / target_sample_rate

    # 오디오 레벨 체크
    audio_level = np.abs(audio_float).mean()
    logger.debug(f"Audio level: {audio_level:.6f}, duration: {audio_duration_sec:.2f}s")

    # 오디오 레벨이 너무 낮으면 무음으로 판단
    if audio_level < 0.001:
        logger.debug("Audio level too low, likely silence")
        return "", 0.0

    # 오디오 통계 로깅
    audio_max = np.abs(audio_float).max()
    audio_rms = np.sqrt(np.mean(audio_float**2))
    logger.info(f"Audio stats - max: {audio_max:.4f}, rms: {audio_rms:.4f}, samples: {len(audio_float)}")

    # Whisper로 음성 인식 (vad_filter 비활성화 - Silero VAD가 이미 처리함)
    loop = asyncio.get_event_loop()
    segments, info = await loop.run_in_executor(
        None,
        lambda: model.transcribe(
            audio_float,
            language="ko",
            beam_size=5,
            vad_filter=False,
            log_prob_threshold=-2.0,  # 기본값 -1.0보다 낮춰서 더 관대하게
            condition_on_previous_text=False,  # 이전 텍스트 의존성 제거
        )
    )

    text = " ".join([seg.text.strip() for seg in segments])

    duration_ms = (time.time() - start_time) * 1000
    log_metric(
        "stt_transcription",
        duration_ms,
        model=WHISPER_MODEL_SIZE,
        audio_duration_sec=round(audio_duration_sec, 2),
        text_length=len(text),
        language=info.language if hasattr(info, 'language') else "ko",
        source_sample_rate=source_sample_rate,
        audio_level=round(audio_level, 6)
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
        logger.info(f"Track subscribed: kind={track.kind}, participant={participant.identity}")
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            logger.debug(f"Skipping non-audio track: {track.kind}")
            return

        logger.info(f"Processing audio from: {participant.identity}")

        async def handle_with_error_logging():
            try:
                await handle_conversation(ctx, vad, track, participant, audio_source)
            except Exception as e:
                logger.error(f"Error in handle_conversation task: {e}", exc_info=True)

        asyncio.create_task(handle_with_error_logging())


class TurnDetector:
    """Turn Detection - 발화 차례 감지"""

    def __init__(self, sample_rate: int = 16000):
        self.sample_rate = sample_rate
        self.speech_start_time: float = None
        self.speech_end_time: float = None
        self.is_speaking = False
        self.is_agent_speaking = False  # AI가 말하고 있는지
        self.pending_turn_task: asyncio.Task = None
        self.prefix_buffer = []  # 발화 시작 전 버퍼
        self.prefix_buffer_ms = TURN_DETECTION_PREFIX_PADDING_MS

    def start_speech(self):
        """발화 시작"""
        self.speech_start_time = time.time()
        self.speech_end_time = None
        self.is_speaking = True
        logger.debug(f"Turn: Speech started")

    def end_speech(self):
        """발화 종료"""
        self.speech_end_time = time.time()
        self.is_speaking = False
        logger.debug(f"Turn: Speech ended")

    def get_speech_duration_ms(self) -> float:
        """발화 길이 (ms)"""
        if self.speech_start_time is None:
            return 0
        end = self.speech_end_time or time.time()
        return (end - self.speech_start_time) * 1000

    def should_process_turn(self) -> bool:
        """턴을 처리해야 하는지 확인"""
        duration = self.get_speech_duration_ms()

        # 최소 발화 길이 체크
        if duration < TURN_DETECTION_MIN_SPEECH_MS:
            logger.debug(f"Turn: Ignored short speech ({duration:.0f}ms < {TURN_DETECTION_MIN_SPEECH_MS}ms)")
            return False

        return True

    def is_interrupt(self) -> bool:
        """인터럽트인지 확인 (AI 말하는 중 사용자가 끼어듦)"""
        if not self.is_agent_speaking:
            return False
        duration = self.get_speech_duration_ms()
        return duration >= INTERRUPT_THRESHOLD_MS

    def add_to_prefix_buffer(self, frame):
        """prefix 버퍼에 프레임 추가"""
        self.prefix_buffer.append((time.time(), frame))
        # 오래된 프레임 제거
        cutoff = time.time() - (self.prefix_buffer_ms / 1000)
        self.prefix_buffer = [(t, f) for t, f in self.prefix_buffer if t > cutoff]

    def get_prefix_frames(self) -> list:
        """prefix 버퍼의 프레임들 반환"""
        return [f for _, f in self.prefix_buffer]


async def handle_conversation(
    ctx: JobContext,
    vad: silero.VAD,
    track: rtc.Track,
    participant: rtc.RemoteParticipant,
    audio_source: rtc.AudioSource,
):
    """음성 대화 처리 루프 (Turn Detection 적용)"""

    audio_stream = rtc.AudioStream(track)
    vad_stream = vad.stream()

    speech_frames = []
    conversation_history = []
    turn_detector = TurnDetector()
    turn_end_task: asyncio.Task = None
    processing_lock = asyncio.Lock()

    async def send_data(data: dict):
        """클라이언트에게 데이터 전송"""
        try:
            payload = json.dumps(data).encode('utf-8')
            await ctx.room.local_participant.publish_data(payload, reliable=True)
        except Exception as e:
            logger.error(f"Failed to send data: {e}")

    async def process_turn(frames: list):
        """턴 처리 - STT → LLM → TTS"""
        nonlocal conversation_history

        async with processing_lock:
            # 전체 파이프라인 시작
            pipeline_start = time.time()

            # 1. STT: 음성 → 텍스트
            user_text, stt_duration = await transcribe_audio(frames)
            if not user_text.strip():
                logger.debug("Turn: Empty transcription, skipping")
                return

            logger.info(f"[{participant.identity}] User: {user_text}")

            # 사용자 발화 텍스트 전송
            await send_data({"type": "transcription", "text": user_text})

            # 2. LLM: 응답 생성
            turn_detector.is_agent_speaking = True
            ai_response, llm_duration = await get_llm_response(user_text, conversation_history)
            logger.info(f"[{participant.identity}] AI: {ai_response}")

            # AI 응답 텍스트 전송
            await send_data({"type": "response", "text": ai_response})

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
                tts_ms=round(tts_duration, 2),
                speech_duration_ms=round(turn_detector.get_speech_duration_ms(), 2)
            )

            if audio_data:
                await play_audio(audio_source, audio_data)

            turn_detector.is_agent_speaking = False

    async def delayed_turn_processing(frames: list):
        """침묵 시간 후 턴 처리"""
        try:
            # 침묵 대기
            await asyncio.sleep(TURN_DETECTION_SILENCE_MS / 1000)

            # 대기 후에도 말하고 있지 않으면 턴 처리
            if not turn_detector.is_speaking:
                logger.info(f"Turn: Processing after {TURN_DETECTION_SILENCE_MS}ms silence")
                await process_turn(frames)
        except asyncio.CancelledError:
            logger.debug("Turn: Delayed processing cancelled (user continued speaking)")

    async def process_audio():
        """오디오 스트림 처리"""
        nonlocal speech_frames
        frame_count = 0

        async for event in audio_stream:
            frame = event.frame
            frame_count += 1

            # 첫 프레임과 100프레임마다 로그
            if frame_count == 1 or frame_count % 100 == 0:
                logger.debug(f"Audio frame {frame_count}: samples={len(frame.data)//2}, sample_rate={frame.sample_rate}")

            vad_stream.push_frame(frame)

            # prefix 버퍼에 항상 추가 (발화 시작 전 오디오 캡처용)
            if not turn_detector.is_speaking:
                turn_detector.add_to_prefix_buffer(frame)

            if turn_detector.is_speaking:
                speech_frames.append(frame)

    async def process_vad():
        """VAD 이벤트 처리 (Turn Detection)"""
        nonlocal speech_frames, turn_end_task

        logger.info("VAD stream processing started")
        event_count = 0

        async for event in vad_stream:
            event_count += 1
            logger.debug(f"VAD event {event_count}: type={event.type}")
            if event.type == agents_vad.VADEventType.START_OF_SPEECH:
                turn_detector.start_speech()

                # prefix 프레임 추가
                prefix_frames = turn_detector.get_prefix_frames()
                speech_frames = prefix_frames.copy()

                # 대기 중인 턴 처리 취소 (사용자가 계속 말함)
                if turn_end_task and not turn_end_task.done():
                    turn_end_task.cancel()
                    logger.debug("Turn: Cancelled pending turn (user continued)")

                # 인터럽트 감지
                if turn_detector.is_agent_speaking:
                    logger.info(f"Turn: User interrupt detected")
                    # TODO: AI 응답 중단 로직 추가 가능

            elif event.type == agents_vad.VADEventType.END_OF_SPEECH:
                turn_detector.end_speech()

                if not speech_frames:
                    continue

                # 최소 발화 길이 체크
                if not turn_detector.should_process_turn():
                    speech_frames = []
                    continue

                frames_to_process = speech_frames.copy()
                speech_frames = []

                # 침묵 후 턴 처리 예약 (바로 처리하지 않음)
                turn_end_task = asyncio.create_task(
                    delayed_turn_processing(frames_to_process)
                )

    try:
        logger.info(f"Starting audio processing for {participant.identity}")
        await asyncio.gather(
            process_audio(),
            process_vad(),
        )
    except Exception as e:
        logger.error(f"Error in handle_conversation: {e}", exc_info=True)


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
