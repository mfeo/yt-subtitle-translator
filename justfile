# Variables
whisper_image := "whisper-server"
whisper_port := "8080"
model_name := "small"
model_dir := "models"
huggingface_base := "https://huggingface.co/ggerganov/whisper.cpp/resolve/main"

# Download whisper model
model name=model_name:
    mkdir -p {{ model_dir }}
    @[ -f {{ model_dir }}/ggml-{{ name }}.bin ] && echo "Model ggml-{{ name }}.bin already exists" || \
      curl -L -o {{ model_dir }}/ggml-{{ name }}.bin {{ huggingface_base }}/ggml-{{ name }}.bin

# Build whisper container (CPU)
whisper-build:
    podman build -f Containerfile -t {{ whisper_image }} .

# Build whisper container (CUDA)
whisper-build-cuda:
    podman build -f Containerfile --build-arg BASE_IMAGE=ghcr.io/ggml-org/whisper.cpp:main-cuda -t {{ whisper_image }}-cuda .

# Run whisper server (CPU)
whisper-run: (model model_name)
    podman run --rm -p {{ whisper_port }}:8080 \
      -v ./{{ model_dir }}:/models \
      {{ whisper_image }}

# Run whisper server (CUDA)
whisper-run-cuda: (model model_name)
    podman run --rm -p {{ whisper_port }}:8080 \
      --device nvidia.com/gpu=all \
      -e LD_LIBRARY_PATH=/usr/lib/wsl/lib:$(ls -d /usr/lib/wsl/drivers/*/ 2>/dev/null | tr '\n' ':') \
      -v ./{{ model_dir }}:/models \
      {{ whisper_image }}-cuda

# Generate extension icons from SVG source
icons:
    bun run scripts/generate-icons.ts

# Verify whisper server is running
whisper-verify:
    curl http://localhost:{{ whisper_port }}/inference -F "file=@/dev/null" -F "response_format=json"
