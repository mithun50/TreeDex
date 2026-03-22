#!/bin/bash
# Generate TTS voiceover — continuous, paced to fit act durations
API_KEY="sk_ga7g62co_c33iM5ndlzrlgmY68UYIMRMp"
API_URL="https://api.sarvam.ai/text-to-speech"
OUT_DIR="public/audio"

mkdir -p "$OUT_DIR"

generate() {
  local key="$1"
  local text="$2"
  local pace="$3"
  local outfile="$OUT_DIR/vo_${key}.wav"

  echo "  [$key] pace=$pace"

  response=$(curl -s -X POST "$API_URL" \
    -H "api-subscription-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"model\": \"bulbul:v3\",
      \"text\": \"$text\",
      \"target_language_code\": \"en-IN\",
      \"speaker\": \"advait\",
      \"pace\": $pace,
      \"temperature\": 0.35,
      \"speech_sample_rate\": 22050,
      \"output_audio_codec\": \"wav\"
    }")

  audio_b64=$(echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'audios' in data and len(data['audios']) > 0:
        print(data['audios'][0])
    else:
        print('ERROR:' + json.dumps(data), file=sys.stderr)
        sys.exit(1)
except Exception as e:
    print('ERROR:' + str(e), file=sys.stderr)
    sys.exit(1)
" 2>&1)

  if echo "$audio_b64" | grep -q "^ERROR:"; then
    echo "  FAILED: $audio_b64"
    return 1
  fi

  echo "$audio_b64" | base64 -d > "$outfile"
  # Print duration
  python3 -c "
import struct
with open('$outfile','rb') as f:
    f.read(4);f.read(4);f.read(4)
    while True:
        cid=f.read(4);cs=struct.unpack('<I',f.read(4))[0]
        if cid==b'fmt ':
            d=f.read(cs);br=struct.unpack('<I',d[8:12])[0];break
        else:f.read(cs)
    while True:
        cid=f.read(4);cs=struct.unpack('<I',f.read(4))[0]
        if cid==b'data':
            print(f'  Saved: {cs/br:.1f}s ({int(cs/br*30)}f)');break
        else:f.read(cs)
"
}

echo "Generating voiceover (advait, paced to fit acts)"
echo ""

# Act1: 270f = 9s, need ~7s of speech (start at frame 30 = 1s in)
generate "act1" \
  "What if RAG understood your document's structure? Introducing TreeDex. Structure-aware document intelligence." \
  1.2

# Act2: 330f = 11s, need ~9s of speech
generate "act2" \
  "Traditional RAG splits documents into flat chunks, destroying sections and hierarchy. Queries return random fragments with no context. The structure is lost." \
  1.15

# Act3: 480f = 16s, need ~13s of speech
generate "act3" \
  "TreeDex takes a different approach. Install with one command. Point it at any PDF. TreeDex scans the table of contents, builds a hierarchical tree, and maps each node to its source pages. No embeddings. No vector database. The structure is preserved." \
  1.15

# Act4: 360f = 12s, need ~10s of speech
generate "act4" \
  "When you query, TreeDex traverses the document tree to find the most relevant sections. Only selected pages are sent to the LLM. Precise context, no noise." \
  1.15

# Act5: 360f = 12s, need ~10s of speech
generate "act5" \
  "TreeDex supports fourteen LLM providers. Works with PDFs, textbooks, and reports. One line to install, one line to index, one line to query. Try TreeDex today." \
  1.15

echo ""
echo "Done!"
