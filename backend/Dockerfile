# backend/Dockerfile
FROM node:22-alpine

WORKDIR /app

# Copia apenas os arquivos de dependência primeiro para aproveitar o cache do Docker
COPY package*.json ./

# Instala as dependências
RUN npm ci

# Copia o restante do código
COPY . .

# Expõe a porta que a API vai rodar (verifique no seu src/server.js, geralmente é 3000 ou 3001)
EXPOSE 3000

# Comando de inicialização
CMD ["npm", "start"]
