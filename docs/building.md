# Local build

Start by installing the dependencies in [System Requirements](/docs/building.md#system-requirements), then [Download NPM dependencies](/docs/building.md#download-npm-dependencies) and finally, run the command in [Running a dev environment](/docs/building.md#running-a-dev-environment). For more information, refer to the rest of this document or the [FAQ](/docs/useful-faqs.md).

## System Requirements

* Java 17 or later (we recommend [OpenJDK](https://adoptium.net/); the Docker image uses 21)
* The [Clojure CLI](https://clojure.org/guides/install_clojure) (`clojure`), 1.11 or later
* [Node.js](https://nodejs.org/) 22 or later, with npm. You can check your version using `node -v`. We recommend installing node using [nvm](https://github.com/creationix/nvm)
* git (the release build takes its version string from `git describe`)

The build is defined in `deps.edn` (dependencies), `shadow-cljs.edn` (ClojureScript builds), `build.clj` (production builds, using [tools.build](https://clojure.org/guides/tools_build)) and `package.json` (npm packages and scripts).

## Download NPM dependencies

    npm ci

(`CYPRESS_INSTALL_BINARY=0 npm ci` skips the Cypress download if you do not run the browser tests.)

## Quickstart

These commands are explained in more depth below, but if you know what you want, here's a quick reference of the most useful ones.

    npm run dev                 # dev server with hot reloading, Less watcher and nREPL
    clojure -T:build release    # production JS and CSS under resources/public
    clojure -M:prod -m bluegenes.core   # start the prod server (after release)
    clojure -T:build uber       # build target/bluegenes.jar
    clojure -T:build:deploy deploy      # build the library jar and deploy it to Clojars

    clojure -M:fmt fix          # run cljfmt to fix code indentation (check: clojure -M:fmt check)
    npm run test:unit           # run the ClojureScript unit tests (node)
    npx cypress run             # run cypress ui tests

## Running a dev environment

You can start a complete developer environment with automatic compilation of Less CSS and hot-reloading of code changes by running:

    npm run dev

This runs `clojure -M:dev:cljs:cljs-dev -m bluegenes.dev` (see `dev/bluegenes/dev.clj`), which in one JVM copies the im-tables CSS, starts the Less watcher, starts [shadow-cljs](https://shadow-cljs.github.io/docs/UsersGuide.html) watching the `:app` build (dashboard on http://localhost:9630, nREPL on port 8777) and then the web server on http://localhost:5000/. Server-side Clojure code is reloaded on each request.

All the output goes to one terminal. If you wish to keep the processes separate, you can start them individually by following the instructions below.

### Compile the CSS

We use [less](http://lesscss.org/) to write our styles.

    npm run less          # compile once
    npm run less:watch    # recompile after every change until you exit it with Ctrl+C

The browser page will automatically reload the updated CSS while shadow-cljs is watching. Before the first CSS build in a fresh checkout, copy the im-tables CSS with `clojure -T:build assets`.

### Make shadow-cljs reload code changes in the browser

    npx shadow-cljs watch app

`npx shadow-cljs compile app` does a single dev build. For a ClojureScript REPL, connect to the nREPL on port 8777 and evaluate `(shadow/repl :app)`.

If BlueGenes is served under a deploy path (`BLUEGENES_DEPLOY_PATH`, see [Configuring](/docs/configuring.md)), `npm run dev` adjusts the dev build's asset path automatically; with a separate watch, pass it yourself: `npx shadow-cljs watch app --config-merge '{:asset-path "/foo/bar/js/compiled"}'`.

### Start the web server

Run this command:

    clojure -M:dev -m bluegenes.core

By default, the web server will be started on http://localhost:5000/. To change this value, edit the corresponding `config.edn`.


## Running tests

### Unit tests

The ClojureScript unit tests (`test/cljs`) run under node with the shadow-cljs `:test` build:

    npm run test:unit

which is `npx shadow-cljs compile test && node target/test/node-tests.js`. For a watch mode, run `npx shadow-cljs watch test` and `node target/test/node-tests.js` after each rebuild. Node has no DOM; `test/cljs/bluegenes/node_env.cljs` provides the few browser globals the code under test needs.

If you need something faster, evaluating `(cljs.test/run-tests)` from a connected editor would be even better. Although with async tests, you'll need some way of [having your editor report the results](https://clojurescript.org/tools/testing#detecting-test-completion-success).

### Cypress integration tests

Checklist:
- You might have to install [additional cypress dependencies](https://docs.cypress.io/guides/guides/continuous-integration.html#Dependencies) to be able to run Cypress.
- The integration tests are designed to be run against [Biotestmine](https://github.com/intermine/biotestmine). The easiest way to achieve this is by using [intermine_boot](https://github.com/intermine/intermine_boot) to start one locally.

Start BlueGenes connected to your local Biotestmine by using the commands below. If your local Biotestmine runs on a different address than http://localhost:9999/biotestmine, change `BLUEGENES_DEFAULT_SERVICE_ROOT`.

    clojure -T:build release
    BLUEGENES_DEFAULT_SERVICE_ROOT=http://localhost:9999/biotestmine \
    BLUEGENES_DEFAULT_MINE_NAME=Biotestmine BLUEGENES_DEFAULT_NAMESPACE=biotestmine \
    BLUEGENES_ADDITIONAL_MINES='[{:root "https://www.flymine.org/flymine" :name "FlyMine" :namespace "flymine"}]' \
    clojure -M -m bluegenes.core

Run all the Cypress tests:

    npx cypress run

Cypress also has a really useful interface for debugging failing tests:

    DEBUG=cypress:* npx cypress open

*Tip:* You can also run the Cypress tests with BlueGenes deployed to a custom deploy path by editing *cypress.json* `baseUrl` key to include the path (e.g. `"http://localhost:5000/foo/bar"`) and passing the same path as an envvar, `BLUEGENES_DEPLOY_PATH=/foo/bar` when starting the server.

# Production Builds

## Testing a minified instance before deploying:

Most of the time, we develop with uncompressed files since it's faster for hot reloads. But for production, we want things to be extra fast on load and we don't hot-reload changes, so it's better to present minified files that have had all un-necessary code stripped. Clojure uses Google Closure tools (yes, Clojure uses Closure) to minify things.

Sometimes the Closure compiler is overzealous and removes something we actually want to keep. To check what your work looks like in a minified build, run this in the terminal (stop any running dev server first, as both write to `resources/public`).

    clojure -T:build release
    clojure -M:prod -m bluegenes.core

The release build runs shadow-cljs in a JVM with only the `:cljs` alias's classpath, so the dev tooling (`:cljs-dev`) and test libraries (`:test`) that `shadow-cljs.edn` adds for dev builds stay out of it. The JavaScript is compiled for ES2018 (`:output-feature-set :es2018`), which every browser from 2018-2020 on supports (Chrome 64, Firefox 58, Safari 12, Edge 79); the shadow-cljs default would be ES2020.

`release` cleans, copies the im-tables CSS, compiles the Less with `lessc`, runs `shadow-cljs release app` (advanced compilation), renames its `app.js` to `app.<hash>.js` (recorded in `resources/public/js/compiled/manifest.edn`) and copies the CSS to `site-<hash>.css`/`im-tables-<hash>.css`.

The hash is also the version key of the state BlueGenes keeps in the browser's local storage: when it changes, users' saved state is reset. So it is computed from the build *inputs*, not from the compiled output: SHA-256 (first 7 hex digits) over the release version string, every file under `src/cljs`, `src/shim` and `less`, `shadow-cljs.edn`, `deps.edn`, `package-lock.json`, and the contents of every jar on the `:cljs` classpath. Two clean builds of the same commit give the same hash; any change to the front end, its dependencies or the version gives a new one. (The compiled JavaScript itself is not byte-for-byte reproducible: gensym'd symbol names inside quoted spec forms depend on compilation order and the shadow-cljs cache, which is why shadow's `:module-hash-names` is not used.)

The release version shown in the UI is `$BLUEGENES_VERSION` if set, otherwise `git describe --always`, otherwise `dev`.


## Deploying your build

### docker

BlueGenes has a Dockerfile which builds the uberjar inside Docker (Clojure CLI, JDK 21 and Node 22) and runs it on an `eclipse-temurin:21-jre` image. The base images are pinned by digest in the Dockerfile.

    docker build --build-arg BLUEGENES_VERSION="$(git describe --always)" -t bluegenes .

`.git` is not sent to Docker (see `.dockerignore`), so the version shown in the UI comes from the `BLUEGENES_VERSION` build argument and is `dev` without it.

Run it and the web server should default to port 5000.

    docker run -p 5000:5000 -it --rm bluegenes

You can specify environment variables by using the `-e` or `--env-file` arguments when calling docker. See [Configuring](/docs/configuring.md) for a list of all available environment variables.

There is also a [prebuilt docker image available on Docker Hub](https://hub.docker.com/r/intermine/bluegenes/tags).

    docker pull intermine/bluegenes:latest

For an example of running BlueGenes in docker for a production environment, start by creating a `bluegenes.env` file.

    BLUEGENES_DEFAULT_SERVICE_ROOT=https://mymine.org/mymine
    BLUEGENES_DEFAULT_MINE_NAME=MyMine
    BLUEGENES_DEFAULT_NAMESPACE=mymine

Once you have added all your environment variables, start the docker container.

    docker run -p 5000:5000 --env-file bluegenes.env -v "$(pwd)"/tools:/tools -d --restart unless-stopped bluegenes

This will create a `tools` folder in the current directory mounted as a docker bind mount. This is so your tools can be persisted when changing BlueGenes versions and to facilitate manual modification of tools.

### Dokku

[Dokku](http://dokku.viewdocs.io/dokku/) allows you to push a Git branch and have it automatically build and serve it using the Dockerfile (there is no Procfile or buildpack; the image's `CMD` starts the server). To show a version in the UI, set the build argument, e.g. `dokku docker-options:add bluegenes build '--build-arg BLUEGENES_VERSION=v1.5.0'`.

Once dokku is configured on your remote host, you'll need to add your public key, create a remote for your host and push to it:

    # On your dokku host
    sudo dokku ssh-keys:add your-user /path/to/your/public/key
    # On your dev computer
    git remote add dokku dokku@your-host:bluegenes
    git push dokku master

If you want to deploy a different branch, you can use `git push dokku dev:master` (replace *dev* with the branch you wish to deploy from) instead.

#### Deploying docker images to dokku instance

You can also deploy docker images that you build locally, to the dokku instance. This is useful since it's much quicker and avoids the extra load on the dokku server from building.
Make sure `youruser` on `dokku-server` is part of the `docker` group. This allows you to stream the file instead of manually transferring it through ssh.

```
docker build --build-arg BLUEGENES_VERSION="$(git describe --always)" -t dokku/appname:v1 .
docker save dokku/appname:v1 | bzip2 | ssh youruser@dokku-server "bunzip2 | docker load"
ssh youruser@dokku-server
sudo dokku tags:deploy appname v1
```

Note that the tag `v1` needs to be unique for each deployment. It is common to use a version string and increment it for each deployment (might not necessarily correspond with version releases). See the [dokku documentation](http://dokku.viewdocs.io/dokku/deployment/methods/images/#deploying-an-image-from-ci) for more information.

### Uberjar

It's also possible to compile BlueGenes to a jar that will automatically launch a server when executed.

To compile and package BlueGenes into an executable jar, run the following command in the project folder:

    clojure -T:build uber

Then, to start the application, execute the jar and pass in a [`config.edn` file](/docs/configuring.md) like so:

    java -jar -Dconfig="config/prod/config.edn" target/bluegenes.jar

For security reasons, the `config.edn` file used to execute the jar can be located anywhere, including your home directory.

You can alternatively bundle `config/prod/config.edn` into the uberjar instead of `config/defaults/config.edn`:

    clojure -T:build uber :prod true

Only `bluegenes.core` is compiled ahead of time; everything else loads from source when the server starts (a few seconds), so a jar built on one JDK (17 or later) runs on any other.


### Launching your uberjar with InterMine

InterMine 2.0 includes a [Gradle target to launch a BlueGenes instance](http://intermine.org/im-docs/docs/system-requirements/software/gradle/index#trying-out-bluegenes).

By default, it launches the latest BlueGenes release from Clojars. If you want to update the version of the JAR being launched, you'll need to create an uberjar (see above).


### Deploying your uberjar to Clojars

Official BlueGenes releases can be deployed to [Clojars](https://clojars.org/), under the [org.intermine Clojars organisation](https://clojars.org/groups/org.intermine).

When deploying BlueGenes to Clojars, the JAR file should include all compiled assets. This includes JavaScript, less, and vendor libraries. This allows other projects to include BlueGenes as a dependency and deploy the client and server without needing to compile BlueGenes (for example `java -cp "lib/*" bluegenes.core` with the jar and its dependencies in `lib/`).

`clojure -T:build jar` builds that jar (`target/bluegenes-<version>.jar`: the server sources, an AOT-compiled `bluegenes.core`, the release assets and a pom listing the server dependencies); `clojure -T:build install` also installs it into `~/.m2`. To deploy it to Clojars (needs `CLOJARS_USERNAME` and `CLOJARS_PASSWORD`, a deploy token):

    $ clojure -T:build:deploy deploy

### Releasing a new version

1. Update the version number (`version` in **build.clj**).
2. Don't forget to add the new version with notes to **CHANGELOG.md**.
3. Commit this change and tag it using `git tag -a v1.0.0 -m "Release v1.0.0"`, replacing *1.0.0* with your version number.
4. Push your commit and tag using `git push origin` followed by `git push origin v1.0.0` (again, replace *1.0.0* with your version number). Make sure that you push to the intermine repository, not just your fork!
5. Deploy the new jar to Clojars with `clojure -T:build:deploy deploy`.
6. Push a new docker image to dockerhub (before pushing, you'll probably want to quickly test it locally).
    1. `docker build --build-arg BLUEGENES_VERSION=v1.0.0 -t bluegenes .`
    2. `docker tag bluegenes intermine/bluegenes:1.0.0` (remember to use your correct version number)
    3. `docker tag bluegenes intermine/bluegenes:latest`
    4. `docker push intermine/bluegenes:1.0.0`
    5. `docker push intermine/bluegenes:latest`
7. Deploy the latest release to dokku with `git push dokku dev:master`.
8. [Draft a new Github release using the newly pushed tag](https://github.com/intermine/bluegenes/tags). It would be a good idea to follow the structure of previous releases; leave the title blank, and copy the description from what you added to the changelog. It's also useful to include links to the Clojars and Docker Hub releases.

# Troubleshooting

1. When things get weird, you might consider clearing both your browser's and BlueGene's cache data. To clear BlueGenes', click on the cog at the top right, then "developer". There should be a big blue button that clears local storage.
2. Verify what branch you have checked out. `dev` is our main development branch, whereas `master` is our production branch.
3. Verify that the InterMine web services ("InterMines") you are using are running the latest InterMine release. You will find a list of InterMines and their current version under the key `intermine_version` in the [InterMine registry](http://registry.intermine.org/service/instances). The changelog for InterMine release versions is [available on GitHub](https://github.com/intermine/intermine/releases).
4. Remember that you can always change which InterMine you're using in BlueGenes by using the cog (top right).

If none of these tips help you, create an [issue](https://github.com/intermine/bluegenes/issues) or [contact us (via chat, email, mailing list, etc.)](http://intermine.org/im-docs/docs/about/contact-us).
