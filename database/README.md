# Database Initialization for Docker

This directory contains the database schema and data files for the NCEA ATAR application.

## Files

### Schema and Initialization
- `init.sql` - Main database initialization script that creates tables with UTF-8 support
- `schema.sql` - Original schema file (kept for reference)

### Data Files
- `02-standards-data.sql` - NCEA standards data with search keywords (includes Māori text with macrons)
- `03-standard-weightings-data.sql` - Standard difficulty weightings by year
- `04-atar-distributions-data.sql` - Historical ATAR distribution data
- `05-participation-rates-data.sql` - Historical participation rates

### Source Data
- `sqldump/` - Original SQL dump files from production database

## Docker Integration

The Docker Compose configuration automatically mounts these files to the MySQL container's initialization directory (`/docker-entrypoint-initdb.d/`). The files are executed in alphabetical order:

1. `01-init.sql` - Creates schema with UTF-8 support
2. `02-standards-data.sql` - Loads standards data
3. `03-standard-weightings-data.sql` - Loads weightings
4. `04-atar-distributions-data.sql` - Loads ATAR distributions
5. `05-participation-rates-data.sql` - Loads participation rates

## Character Encoding

All files are configured to use `utf8mb4` character set with `utf8mb4_unicode_ci` collation to properly support Māori text with macrons (ā, ē, ī, ō, ū).

## Starting Fresh

To reinitialize the database:

1. Stop the containers: `docker-compose down`
2. Remove the volume: `docker volume rm ncea-2-atar_mysql_data`
3. Start again: `docker-compose up`

The database will be automatically recreated with all data loaded. 