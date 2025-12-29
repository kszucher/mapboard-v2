from sqlalchemy import create_engine, text
from app.config import settings

def clear_alembic():
    url = settings.database_url.replace('postgresql+asyncpg://', 'postgresql+psycopg://')
    engine = create_engine(url)
    with engine.connect() as conn:
        conn.execute(text('DROP TABLE IF EXISTS alembic_version'))
        conn.commit()
    print('Dropped alembic_version table')

if __name__ == "__main__":
    clear_alembic()
