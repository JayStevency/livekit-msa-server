"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Room,
  RoomEvent,
  Track,
  LocalAudioTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
} from "livekit-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

type ConnectionStatus = "disconnected" | "connecting" | "connected";

export function VoiceChat() {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [messages, setMessages] = useState<Message[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const log = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-100), `[${time}] ${msg}`]);
    console.log(msg);
  }, []);

  const addMessage = useCallback((role: Message["role"], content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role, content },
    ]);
  }, []);

  const getToken = useCallback(
    async (roomName: string, participantName: string) => {
      // 먼저 방 생성 (이미 있으면 무시)
      await fetch(`${API_URL}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName }),
      }).catch(() => {}); // 이미 존재하는 경우 무시

      // 방 참가 및 토큰 발급
      const res = await fetch(`${API_URL}/rooms/${roomName}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: roomName,
          identity: participantName,
          name: participantName,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(errorData)}`);
      }

      const data = await res.json();
      log(`Token received for room: ${roomName}`);
      return data.token;
    },
    [log]
  );

  const setupAudioVisualizer = useCallback(
    (track: LocalAudioTrack) => {
      try {
        const mediaStream = new MediaStream([track.mediaStreamTrack]);
        audioContextRef.current = new AudioContext();
        const source =
          audioContextRef.current.createMediaStreamSource(mediaStream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
        log("Audio visualizer setup complete");
      } catch (err) {
        log(`Visualizer error: ${err}`);
      }
    },
    [log]
  );

  const connect = useCallback(async () => {
    try {
      setStatus("connecting");
      log("Starting connection...");

      const roomName = "voice-chat-" + Date.now();
      const participantName =
        "user-" + Math.random().toString(36).substring(2, 9);

      const token = await getToken(roomName, participantName);

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      room.on(RoomEvent.Connected, () => {
        log("Connected to room");
        setStatus("connected");
      });

      room.on(RoomEvent.Disconnected, () => {
        log("Disconnected from room");
        setStatus("disconnected");
      });

      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        log(`Participant joined: ${participant.identity}`);
        addMessage("system", `${participant.identity} 참가`);
      });

      room.on(
        RoomEvent.TrackSubscribed,
        (
          track: RemoteTrack,
          publication: RemoteTrackPublication,
          participant: RemoteParticipant
        ) => {
          log(`Track subscribed: ${track.kind} from ${participant.identity}`);

          if (track.kind === Track.Kind.Audio) {
            const audioElement = track.attach();
            audioElement.id = "ai-audio";
            document.body.appendChild(audioElement);
            log("AI audio track attached");
          }
        }
      );

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach();
      });

      room.on(
        RoomEvent.DataReceived,
        (payload: Uint8Array, participant?: RemoteParticipant) => {
          try {
            const data = JSON.parse(new TextDecoder().decode(payload));
            log(`Data received: ${JSON.stringify(data)}`);

            if (data.type === "transcription") {
              addMessage("user", data.text);
            } else if (data.type === "response") {
              addMessage("assistant", data.text);
            }
          } catch (e) {
            log(`Data parse error: ${e}`);
          }
        }
      );

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const isUserSpeaking = speakers.some(
          (s) => s.identity === room.localParticipant.identity
        );
        setIsSpeaking(isUserSpeaking);
      });

      await room.connect(LIVEKIT_URL, token);
      log(`Connected to room: ${roomName}`);

      const publication = await room.localParticipant.setMicrophoneEnabled(true);
      if (publication && publication.track) {
        const audioTrack = publication.track as LocalAudioTrack;
        audioTrackRef.current = audioTrack;
        setupAudioVisualizer(audioTrack);
        log("Local audio track published");
      }

      roomRef.current = room;
    } catch (err) {
      log(`Connection error: ${err}`);
      setStatus("disconnected");
    }
  }, [getToken, log, addMessage, setupAudioVisualizer]);

  const disconnect = useCallback(async () => {
    try {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }

      audioTrackRef.current = null;
      setStatus("disconnected");
      setIsSpeaking(false);
      log("Disconnected");

      const aiAudio = document.getElementById("ai-audio");
      if (aiAudio) aiAudio.remove();
    } catch (err) {
      log(`Disconnect error: ${err}`);
    }
  }, [log]);

  const toggleConnection = useCallback(() => {
    if (status === "connected") {
      disconnect();
    } else if (status === "disconnected") {
      connect();
    }
  }, [status, connect, disconnect]);

  // 페이지 로드 시 자동 연결
  useEffect(() => {
    // 1초 후 자동 연결
    const timer = setTimeout(() => {
      if (status === "disconnected") {
        connect();
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white/5 border-b border-white/10 px-5 py-4 flex justify-between items-center">
        <h1 className="text-white text-xl font-semibold">Voice Chat</h1>
        <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1.5 rounded-full text-xs font-medium">
          LiveKit + AI
        </span>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span
            className={`w-2 h-2 rounded-full ${
              status === "connected"
                ? "bg-green-500"
                : status === "connecting"
                ? "bg-yellow-500 animate-pulse"
                : "bg-red-500"
            }`}
          />
          <span>
            {status === "connected"
              ? "Connected"
              : status === "connecting"
              ? "Connecting..."
              : "Disconnected"}
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 max-w-4xl mx-auto w-full">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-10">
            <h2 className="text-white text-2xl mb-3">AI 음성 대화</h2>
            <p className="text-sm leading-relaxed">
              {status === "connecting" ? "연결 중..." : status === "connected" ? "연결됨 - 바로 말하세요!" : "자동 연결 중..."}
              <br />
              음성이 자동 인식되어 AI가 응답합니다.
            </p>
            <div className="bg-white/5 rounded-xl p-4 mt-5 text-left inline-block">
              <h3 className="text-white text-sm mb-2">사용 방법</h3>
              <ol className="text-gray-500 text-xs space-y-1 list-decimal list-inside">
                <li>페이지 로드 시 자동 연결</li>
                <li>연결되면 바로 말하기 시작</li>
                <li>AI가 자동으로 음성 인식 (VAD)</li>
                <li>말 끝나면 자동 응답</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.role === "user" ? "flex-row-reverse" : ""
                } ${msg.role === "system" ? "justify-center" : ""}`}
              >
                {msg.role === "system" ? (
                  <span className="text-gray-500 text-xs">{msg.content}</span>
                ) : (
                  <>
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${
                        msg.role === "user"
                          ? "bg-gradient-to-br from-purple-500 to-pink-500"
                          : "bg-gradient-to-br from-green-500 to-emerald-500"
                      }`}
                    >
                      {msg.role === "user" ? "👤" : "🤖"}
                    </div>
                    <div
                      className={`px-4 py-3 rounded-2xl max-w-[80%] ${
                        msg.role === "user"
                          ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-br-sm"
                          : "bg-white/10 text-gray-200 rounded-bl-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Voice Control */}
      <div className="flex flex-col items-center gap-4 p-5 pb-8">
        {/* Audio Visualizer */}
        <div className="flex gap-1 items-center h-10">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-100 ${
                status === "connected"
                  ? "bg-gradient-to-t from-purple-500 to-pink-500"
                  : "bg-gray-600"
              }`}
              style={{
                height: isSpeaking
                  ? `${Math.random() * 30 + 10}px`
                  : `${10 + i * 3}px`,
              }}
            />
          ))}
        </div>

        {/* Mic Button */}
        <button
          onClick={toggleConnection}
          disabled={status === "connecting"}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
            status === "connected"
              ? isSpeaking
                ? "bg-gradient-to-br from-red-500 to-red-600 animate-pulse-ring"
                : "bg-gradient-to-br from-green-500 to-emerald-500"
              : status === "connecting"
              ? "bg-gray-500 opacity-50 cursor-not-allowed"
              : "bg-gradient-to-br from-purple-500 to-pink-500 hover:scale-105"
          } shadow-lg`}
        >
          <svg className="w-9 h-9 fill-white" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        </button>

        {/* Status Text */}
        <span
          className={`text-sm ${
            status === "connected"
              ? "text-green-500"
              : status === "connecting"
              ? "text-yellow-500"
              : "text-gray-400"
          }`}
        >
          {status === "connected"
            ? "연결됨 - 바로 말하세요 (자동 인식)"
            : status === "connecting"
            ? "연결 중..."
            : "자동 연결 대기 중..."}
        </span>

        {/* Controls */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="px-4 py-2 bg-white/10 border border-white/10 rounded-lg text-gray-400 text-sm hover:bg-white/15 hover:text-white transition-colors"
          >
            로그 보기
          </button>
          <button
            onClick={() => setMessages([])}
            className="px-4 py-2 bg-white/10 border border-white/10 rounded-lg text-gray-400 text-sm hover:bg-white/15 hover:text-white transition-colors"
          >
            대화 초기화
          </button>
        </div>
      </div>

      {/* Log Panel */}
      {showLogs && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/95 text-green-400 font-mono text-xs max-h-40 overflow-y-auto">
          <div className="sticky top-0 flex justify-between items-center bg-black/95 p-2 border-b border-white/10">
            <span className="text-gray-400">Logs</span>
            <button
              onClick={() => setShowLogs(false)}
              className="text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/10"
            >
              ✕
            </button>
          </div>
          <div className="p-3">
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
