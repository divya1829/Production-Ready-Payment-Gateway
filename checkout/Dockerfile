FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./
RUN npm install --production

# Copy application files
COPY . .

# Create public directory for SDK (will be built separately or copied)
RUN mkdir -p public

EXPOSE 3001

CMD ["npm", "start"]
