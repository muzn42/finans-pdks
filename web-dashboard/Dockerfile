FROM nginx:alpine

# Albayrak Finans PDKS - Kurumsal Web Dashboard
COPY index.html /usr/share/nginx/html/index.html
COPY styles.css /usr/share/nginx/html/styles.css
COPY core.js /usr/share/nginx/html/core.js
COPY data.js /usr/share/nginx/html/data.js
COPY app.js /usr/share/nginx/html/app.js

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
