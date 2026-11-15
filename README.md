

# BlueGenes

<!-- The badge points at the maintenance fork for now. When this work is merged
     upstream, replace gmicklem/bluegenes with intermine/bluegenes (both URLs). -->
[![CI](https://github.com/gmicklem/bluegenes/actions/workflows/ci.yml/badge.svg)](https://github.com/gmicklem/bluegenes/actions/workflows/ci.yml)

_An InterMine Web-based GUI_


## About

BlueGenes is designed to make searching and analysing genomic data easy. It's powered by [InterMine](http://intermine.org/) web services, meaning that the data from over 30 InterMines worldwide can be accessed from the same familiar interface.

### Screenshots

![BlueGenes screenshots](https://user-images.githubusercontent.com/3865590/114040064-2c814200-987b-11eb-8970-cb736eaede79.png)


## Try Online

[BlueGenes Live](http://bluegenes.apps.intermine.org/)


## Contributing

Check out our [contributing guidelines](https://github.com/intermine/bluegenes/blob/dev/CONTRIBUTING.md).


### Setting up a local development environment

[Building instructions (for both Dev and Production builds)](docs/building.md).

[Configuring a local build](docs/configuring.md)

[Development resources](docs/developing.md)

Third-party CSS and JavaScript loaded from CDNs in `src/clj/bluegenes/index.clj` are pinned with Subresource Integrity hashes. When bumping one of those URLs, run `script/cdn-sri.sh` to print the new `integrity` value for every CDN URL in that file (or pass URLs as arguments) and paste it next to the URL.


## Need further help?

- For learning the BlueGenes user interface, check out the [user documentation](http://intermine.org/intermine-user-docs/)
- For information on the InterMine backend, check out the [InterMine documentation](http://intermine.org/im-docs/)
- [Chat with us](http://chat.intermine.org) during UK office hours


## License

Copyright (C) since 2016, BlueGenes contributors

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, version 2.1.

You should have received a copy of the GNU Lesser General Public License along with this program.
If not, see <http://www.gnu.org/licenses/>.

## Credits

Icons are a mix of [fontawesome](https://fontawesome.com/) and [icomoon](https://icomoon.io/) free icons. We also use the [bootstrap material design theme](https://mdbootstrap.com/).
