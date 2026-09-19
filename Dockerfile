# ---- 阶段 1：安装依赖并构建前端 ----
FROM node:20-alpine AS build
WORKDIR /app

# 先拷依赖清单，利用层缓存
COPY package.json package-lock.json* ./
RUN npm install

# 拷贝源码并构建 React 产物到 dist/
COPY . .
RUN npm run build

# 去掉开发依赖，只保留生产运行时需要的包
RUN npm prune --omit=dev

# ---- 阶段 2：运行时（Express 托管 API + 前端静态文件，单端口）----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/package.json ./package.json

EXPOSE 3000

# 容器启动即服务（首次启动自动写入 data/state.json 演示数据）
CMD ["node", "server/index.js"]
