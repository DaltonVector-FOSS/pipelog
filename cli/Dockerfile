FROM rust:1.78-alpine AS builder

RUN apk add --no-cache musl-dev openssl-dev pkgconfig

WORKDIR /app
COPY . .

RUN cargo build --release

# ---- runtime ----
FROM alpine:3.19
RUN apk add --no-cache ca-certificates openssl libgcc

COPY --from=builder /app/target/release/pipelog /usr/local/bin/pipelog

ENTRYPOINT ["pipelog"]
