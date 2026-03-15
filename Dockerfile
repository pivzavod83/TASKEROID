FROM nginx:alpine

# Copy static files
COPY . /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Railway injects $PORT — nginx listens on it
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
