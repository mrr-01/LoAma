# Frontend Docker
FROM nginx:alpine

#Copy static frontend files to Nginx web Root
COPY . /usr/share/nginx/html

#Overwrite Nginx default server configuraton with custom proxy config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

#Start Ngnix in the foreground
CMD [ "nginx", "-g", "daemon off;" ]
