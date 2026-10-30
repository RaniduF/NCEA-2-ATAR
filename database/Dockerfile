FROM postgres:15-alpine

COPY init.sql                          /sql/01-init.sql
COPY 02-standards-data.sql             /sql/02-standards-data.sql
COPY 03-standard-weightings-data.sql   /sql/03-standard-weightings-data.sql
COPY 04-atar-distributions-data.sql    /sql/04-atar-distributions-data.sql
COPY 05-participation-rates-data.sql   /sql/05-participation-rates-data.sql
COPY 06-alter-tables.sql               /sql/06-alter-tables.sql
COPY 07-atar-map.sql                   /sql/07-atar-map.sql
COPY run-migrations.sh                 /sql/run-migrations.sh

RUN chmod +x /sql/run-migrations.sh

ENTRYPOINT ["/sql/run-migrations.sh"]
