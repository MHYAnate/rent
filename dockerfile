## use officail nodejs as pareent image
FROM node:22-alpine

## set working directory
WORKDIR /app

## copy package.json and package-lock.json
COPY package*.json ./

## install dependencies
RUN npm install

## copy all files to working directory
COPY . .
## expose port
EXPOSE 3000

## start the app
CMD ["node", "./src/server.js"]