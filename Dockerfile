# Builds BlueGenes from a checkout and runs it (also what Dokku uses):
#   docker build -t bluegenes .
#   docker run -p 5000:5000 -it --rm bluegenes
# Configure with environment variables (docs/configuring.md).

# Node 22 for npm, lessc and shadow-cljs.
FROM node:22-bookworm-slim AS node

# Build stage: Clojure CLI on JDK 21, plus node from the stage above.
FROM clojure:temurin-21-tools-deps-bookworm-slim AS build
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
RUN clojure -P -M:cljs
COPY . .
# The release version shown in the UI comes from `git describe` (.git is in
# the build context); without it, it is "dev".
RUN clojure -T:build uber

# Runtime stage: just the uberjar on a JRE.
FROM eclipse-temurin:21-jre
COPY --from=build /build/target/bluegenes.jar /
WORKDIR /
EXPOSE 5000
CMD ["java", "-jar", "/bluegenes.jar"]
