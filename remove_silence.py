from pydub import AudioSegment
from pydub.silence import detect_leading_silence
import os

# iterate through all mp3 files in the given folder
folder = "src/hymns/audio"

for filename in os.listdir(folder):
    if filename.endswith(".mp3"):
        print(f"Processing file: {filename}")

        # Load your LilyPond generated file
        sound = AudioSegment.from_file(os.path.join(folder, filename), format="mp3")

        # Reverse to find trailing silence
        reversed_sound = sound.reverse()
        trailing_silence = detect_leading_silence(reversed_sound, silence_threshold=-50.0)

        print(f"Trailing silence duration: {trailing_silence} ms")

        # Keep everything except the trailing silence duration
        trimmed_sound = sound[:-trailing_silence]
        trimmed_sound.export(os.path.join(folder, filename), format="mp3")


