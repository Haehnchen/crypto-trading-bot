FROM hdthuan/node:10

# Install build-essential, sqlite in order
RUN apt-get update && apt-get install -y \
    sqlite \
&& rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Install app dependencies
COPY . /usr/src/app
RUN npm install --production

# Apply all patches in app
RUN npm run postinstall
