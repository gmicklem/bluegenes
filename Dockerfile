# Builds BlueGenes from a checkout and runs it (also what Dokku uses):
#   docker build --build-arg BLUEGENES_VERSION="$(git describe --always)" -t bluegenes .
#   docker run -p 5000:5000 -it --rm bluegenes
# Configure with environment variables (docs/configuring.md).
# BLUEGENES_VERSION is the version shown in the UI; .git is not part of the
# build context (.dockerignore; Dokku drops it too), so without the argument
# it is "dev". The base images are pinned by digest (multi-arch index digests
# of the tags named in the comments, 2026-11-15); refresh them deliberately.

# Node 22 for npm, lessc and shadow-cljs.
# node:22-bookworm-slim
FROM node@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS node

# Build stage: Clojure CLI on JDK 21, plus node from the stage above.
# clojure:temurin-21-tools-deps-bookworm-slim
FROM clojure@sha256:c9e8c8ddfa14f3d49ef31db775bf77368ee6be658f82865d527523045d20a26d AS build
# git: npm falls back to cloning the bootstrap-material-design git dependency
# if the GitHub tarball download fails.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
WORKDIR /build
COPY package.json package-lock.json ./
RUN CYPRESS_INSTALL_BINARY=0 npm ci
COPY deps.edn ./
# Download the dependencies the build needs into their own layer: :cljs
# (release build and bundle hash; the server deps are a subset) and the
# :build tool alias. :cljs-dev and :test are only for dev builds and unit
# tests, which the image does not run.
RUN clojure -P -M:cljs && clojure -P -T:build
COPY . .
ARG BLUEGENES_VERSION=dev
ENV BLUEGENES_VERSION=${BLUEGENES_VERSION}
RUN clojure -T:build uber

# Runtime stage: just the uberjar on a JRE.
# eclipse-temurin:21-jre
FROM eclipse-temurin@sha256:18bb4a91a3dea3f03ee31d3755af34dfb40f904fc77ab56cdc2f092e32fff9c2
COPY --from=build /build/target/bluegenes.jar /
WORKDIR /
EXPOSE 5000
CMD ["java", "-jar", "/bluegenes.jar"]
