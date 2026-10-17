"""Authentication: PBKDF2 password hashing + server-side sessions in SQLite.

No third-party crypto deps — uses the stdlib (hashlib/secrets/hmac), which is
solid for this scale. Sessions are random opaque tokens stored in the DB and
carried in an httpOnly cookie.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta

from sqlmodel import select

from .. import db
from ..models import User, UserSession

_ITERATIONS = 200_000
SESSION_DAYS = 30
COOKIE = "session"


# --- passwords -------------------------------------------------------------
def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _ITERATIONS)
    return f"pbkdf2${_ITERATIONS}${salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _algo, iters, salt, want = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iters))
        return hmac.compare_digest(dk.hex(), want)
    except Exception:
        return False


# --- users -----------------------------------------------------------------
def user_count() -> int:
    with db.get_session() as s:
        return len(s.exec(select(User)).all())


def get_user(username: str) -> User | None:
    with db.get_session() as s:
        return s.exec(select(User).where(User.username == username)).first()


def create_user(username: str, password: str, email: str = "") -> User:
    # first user becomes admin
    role = "admin" if user_count() == 0 else "user"
    with db.get_session() as s:
        u = User(username=username.strip(), email=email.strip(),
                 password_hash=hash_password(password), role=role)
        s.add(u); s.commit(); s.refresh(u)
        return u


# --- sessions --------------------------------------------------------------
def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires = (datetime.now() + timedelta(days=SESSION_DAYS)).isoformat()
    with db.get_session() as s:
        s.add(UserSession(token=token, user_id=user_id, expires_at=expires))
        s.commit()
    return token


def user_for_token(token: str | None) -> User | None:
    if not token:
        return None
    with db.get_session() as s:
        sess = s.get(UserSession, token)
        if not sess:
            return None
        if sess.expires_at and sess.expires_at < datetime.now().isoformat():
            s.delete(sess); s.commit()
            return None
        return s.get(User, sess.user_id)


def delete_session(token: str | None) -> None:
    if not token:
        return
    with db.get_session() as s:
        sess = s.get(UserSession, token)
        if sess:
            s.delete(sess); s.commit()
