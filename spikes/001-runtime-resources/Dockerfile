FROM node:24.13.0-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
RUN npm run build

FROM node:24.13.0-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/build ./build
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
RUN node -e "const fs=require('fs');for(const d of ['build','dist'])for(const f of fs.readdirSync(d,{recursive:true}))if(String(f).endsWith('.map'))fs.rmSync(d+'/'+f)"
USER 10001:10001
EXPOSE 3000
CMD ["node", "build"]
