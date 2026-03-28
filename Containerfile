ARG BASE_IMAGE=ghcr.io/ggml-org/whisper.cpp:main
FROM ${BASE_IMAGE}

EXPOSE 8080

ENTRYPOINT ["/app/build/bin/whisper-server"]
CMD ["--model", "/models/ggml-small.bin", "--host", "0.0.0.0", "--port", "8080"]
