# Use the official Node.js 18 image.
# Check https://hub.docker.com/_/node to select a different version
FROM node:18

# Create app directory
WORKDIR /usr/src/app

# Install pnpm
RUN npm install -g pnpm

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json pnpm-lock.yaml* ./


RUN pnpm install
# RUN rm -rf node_modules/dotenv
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

# Your app binds to port 3000 so you'll use the EXPOSE instruction to have it mapped by the docker daemon
EXPOSE 5000

CMD [ "pnpm", "start" ]
