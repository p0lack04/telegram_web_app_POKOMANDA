# Isolated test image built from the upstream source release (AGPL-3.0).
# Upstream no longer distributes the old Docker Hub images.
FROM golang:1.24.8-bookworm AS build
RUN CGO_ENABLED=0 go install github.com/minio/minio@RELEASE.2025-10-15T17-29-55Z
FROM debian:bookworm-slim
COPY --from=build /go/bin/minio /usr/local/bin/minio
ENTRYPOINT ["/usr/local/bin/minio"]
