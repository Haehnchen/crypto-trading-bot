FROM node:11

MAINTAINER Daniel Espendiller <daniel@espendiller.net>

RUN apt-get update && apt-get install -y \
    sqlite

# clean image
RUN rm -rf /var/lib/apt/lists/*

WORKDIR /src

ENTRYPOINT ["node"]
CMD ["index.js", "trade" ]
