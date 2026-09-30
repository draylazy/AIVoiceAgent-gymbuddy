import os
import edge_tts
from typing import AsyncGenerator

DEFAULT_VOICE = os.getenv("EDGE_TTS_VOICE", "en-US-ChristopherNeural")
DEFAULT_PITCH = os.getenv("EDGE_TTS_PITCH", "-5Hz")

async def generate_speech_stream(
    text: str, 
    voice: str = None, 
    pitch: str = None
) -> AsyncGenerator[bytes, None]:
    """
    Asynchronously streams MP3 audio bytes using Microsoft Edge TTS.
    Default voice is en-US-ChristopherNeural (US English Male).
    """
    selected_voice = voice or os.getenv("EDGE_TTS_VOICE", DEFAULT_VOICE)
    selected_pitch = pitch or os.getenv("EDGE_TTS_PITCH", DEFAULT_PITCH)

    communicate = edge_tts.Communicate(text, selected_voice, pitch=selected_pitch)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            yield chunk["data"]

async def generate_speech_bytes(
    text: str, 
    voice: str = None, 
    pitch: str = None
) -> bytes:
    """
    Generates complete MP3 audio bytes using Microsoft Edge TTS.
    """
    audio_chunks = []
    async for chunk in generate_speech_stream(text, voice=voice, pitch=pitch):
        audio_chunks.append(chunk)
    return b"".join(audio_chunks)
