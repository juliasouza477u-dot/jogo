from datetime import datetime
from extensions import db


class Question(db.Model):
    __tablename__ = "questions"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(160), nullable=False)
    reference = db.Column(db.String(160), nullable=False)
    sub_questions = db.relationship(
        "SubQuestion",
        backref="question",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def to_dict(self):
        return {"id": self.id, "title": self.title, "reference": self.reference}


class SubQuestion(db.Model):
    __tablename__ = "sub_questions"

    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(
        db.Integer, db.ForeignKey("questions.id"), nullable=False, index=True
    )
    text = db.Column(db.Text, nullable=False)
    answer = db.Column(db.Text, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "question_id": self.question_id,
            "text": self.text,
            "answer": self.answer,
        }


class Score(db.Model):
    __tablename__ = "scores"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    points = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "points": self.points,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }