import os
import random
from flask import Flask, render_template, request, redirect, url_for, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-me")

database_url = os.environ.get("DATABASE_URL")
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
elif database_url and database_url.startswith("postgresql://") and "+psycopg" not in database_url:
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = database_url or "sqlite:///game.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

from extensions import db

db.init_app(app)

from models import Question, SubQuestion, Score  # noqa: E402

# ---------------------------------------------------------------------------
# Dados de semente: as 2 perguntas fornecidas + 20 novas inventadas.
# Cada item: (titulo, referencia, [(texto_pergunta, resposta), ...])
# ---------------------------------------------------------------------------
SEED = [
    (
        "1 Coríntios 12, 4-11",
        "Dons do Espírito e Unidade",
        [
            ("De acordo com o versículo 4, o que existe em grande diversidade, mas provém do mesmo e único Espírito?", "Os dons (carismas)."),
            ("Segundo o versículo 5, há diversidade de ministérios (serviços), mas quem é o mesmo a quem todos servem?", "O mesmo Senhor (Jesus Cristo)."),
            ("No versículo 6, o texto diz que há diversidade de operações/realizações, mas quem é aquele que opera tudo em todos?", "O mesmo Deus (o Pai)."),
            ("De acordo com o versículo 7, para qual finalidade a manifestação do Espírito é dada a cada um?", "Para o bem comum (para edificar a comunidade)."),
            ("No versículo 8, qual é o primeiro dom específico mencionado que é dado a alguém pelo Espírito?", "A palavra de sabedoria."),
            ("Ainda no versículo 8, qual dom aparece logo ao lado da palavra de sabedoria?", "A palavra de ciência (ou conhecimento)."),
            ("Segundo o versículo 9, qual virtude/dom é concedido a outro pelo mesmo Espírito?", "A fé."),
            ("No versículo 9, qual dom relacionado à restauração da saúde física/espiritual é concedido?", "O dom de curas."),
            ("No versículo 10, qual dom está associado à realização de sinais extraordinários?", "O dom de operar milagres."),
            ("Ainda no versículo 10, qual dom consiste na capacidade de proclamar a palavra inspirada por Deus?", "O dom de profecia."),
            ("Qual dom citado no versículo 10 dá a capacidade de reconhecer se uma inspiração vem de Deus ou não?", "O dom de discernimento dos espíritos."),
            ("Ainda no versículo 10, qual é o dom ligado à oração e louvor em linguagem inspirada?", "A diversidade (ou variedade) de línguas."),
            ("Para completar a utilidade do dom das línguas na comunidade, qual dom o versículo 10 menciona em seguida?", "A interpretação das línguas."),
            ("Conforme o versículo 11, quem é o agente responsável por realizar e distribuir todas essas manifestações?", "Um só e o mesmo Espírito Santo."),
            ("Como o Espírito Santo distribui esses dons a cada pessoa, segundo o final do versículo 11?", "A cada um em particular, como Ele quer (conforme a Sua vontade)."),
        ],
    ),
    (
        "Lucas 1, 39-56",
        "A Visitação e o Magnificat",
        [
            ("Segundo o versículo 39, qual foi a atitude de Maria logo após saber da gravidez de Isabel?", "Pôs-se a caminho e foi apressadamente à região montanhosa, a uma cidade de Judá."),
            ("De acordo com o versículo 40, em cuja casa Maria entrou e a quem ela saudou?", "Entrou na casa de Zacarias e saudou Isabel."),
            ("O que aconteceu com a criança no ventre de Isabel assim que ela ouviu a saudação de Maria (v. 41)?", "A criança estremeceu (pulou de alegria) em seu ventre."),
            ("O que aconteceu com a própria Isabel quando Maria a saudou (v. 41)?", "Isabel ficou cheia do Espírito Santo."),
            ("Com qual proclamação e em alta voz Isabel acolheu Maria no versículo 42?", "Bendita és tu entre as mulheres e bendito é o fruto do teu ventre!"),
            ("Como Isabel chama Maria no versículo 43 ao se admirar com a visita?", "A mãe do meu Senhor."),
            ("Segundo o versículo 45, por que Maria é chamada de bem-aventurada (feliz) por Isabel?", "Porque acreditou que se cumpririam as coisas ditas da parte do Senhor."),
            ("Como se inicia o hino de louvor de Maria (o Magnificat) no versículo 46?", "A minha alma engrandece o Senhor."),
            ("No versículo 47, onde se alegra o espírito de Maria?", "Em Deus, seu Salvador."),
            ("Por que, segundo o versículo 48, todas as gerações chamarão Maria de bem-aventurada?", "Porque Deus olhou para a humilde condição de sua serva e o Todo-Poderoso fez nela grandes coisas."),
            ("De acordo com os versículos 50 e 51, sobre quem repousa a misericórdia de Deus e o que Ele faz com os orgulhosos?", "A misericórdia repousa de geração em geração sobre os que o temem, e Ele dispersa os orgulhosos de coração."),
            ("O que Deus faz com os poderosos e com os humildes, segundo o versículo 52?", "Derruba os poderosos de seus tronos e eleva os humildes."),
            ("Conforme o versículo 53, como Deus trata os famintos e os ricos?", "Enche de bens os famintos e despede os ricos de mãos vazias."),
            ("Segundo o versículo 54-55, a quem Deus acolheu lembrando-se de sua misericórdia e das promessas feitas aos antepassados?", "A Israel, seu servo, conforme prometera a Abraão e à sua descendência para sempre."),
            ("Quanto tempo Maria permaneceu com Isabel antes de voltar para sua casa (v. 56)?", "Cerca de três meses."),
        ],
    ),
]

# 20 perguntas inventadas (catecismo cristão)
SEED += [
    (
        "O que é a Sagrada Escritura?",
        "Catecismo - Revelação",
        [("O que é a Sagrada Escritura?", "A Palavra de Deus escrita sob inspiração do Espírito Santo.")],
    ),
    (
        "Quem é a Virgem Maria?",
        "Catecismo - Maria",
        [("Quem é a Virgem Maria para os cristãos?", "Mãe de Jesus e Mãe de Deus.")],
    ),
    (
        "O que é o Batismo?",
        "Catecismo - Sacramentos",
        [("O que é o Batismo?", "O primeiro sacramento que nos torna filhos de Deus e membros da Igreja.")],
    ),
    (
        "A Santíssima Trindade",
        "Catecismo - Deus",
        [("Quantas Pessoas existem na Santíssima Trindade?", "Três: Pai, Filho e Espírito Santo.")],
    ),
    (
        "O que é a Eucaristia?",
        "Catecismo - Sacramentos",
        [("O que é a Eucaristia?", "O sacramento do Corpo e do Sangue de Cristo.")],
    ),
    (
        "Quem fundou a Igreja?",
        "Catecismo - Igreja",
        [("Quem fundou a Igreja?", "Jesus Cristo.")],
    ),
    (
        "O perdão na Confissão",
        "Catecismo - Sacramentos",
        [("O que é o perdão dos pecados no sacramento da Confissão?", "A reconciliação com Deus e com a Igreja.")],
    ),
    (
        "O maior mandamento",
        "Catecismo - Moral",
        [("Qual é o maior mandamento?", "Amar a Deus sobre todas as coisas e ao próximo como a si mesmo.")],
    ),
    (
        "Quem é o Espírito Santo?",
        "Catecismo - Deus",
        [("Quem é o Espírito Santo?", "A terceira Pessoa da Santíssima Trindade, Deus.")],
    ),
    (
        "O que é a graça?",
        "Catecismo - Teologia",
        [("O que é a graça?", "O dom gratuito de Deus que nos santifica.")],
    ),
]

SEED += [
    (
        "Quantos são os sacramentos?",
        "Catecismo - Igreja",
        [("Quantos são os sacramentos?", "Sete.")],
    ),
    (
        "O que é a fé?",
        "Catecismo - Virtudes",
        [("O que é a fé?", "A virtude pela qual cremos em Deus e em tudo o que Ele revelou.")],
    ),
    (
        "Quem é o Papa?",
        "Catecismo - Igreja",
        [("Quem é o Papa?", "O sucessor de Pedro, chefe visível da Igreja.")],
    ),
    (
        "O que é o Credo?",
        "Catecismo - Oração",
        [("O que é o Credo?", "A oração que resume as crenças cristãs.")],
    ),
    (
        "Qual é o papel dos anjos?",
        "Catecismo - Anjos",
        [("Qual é o papel dos anjos?", "Mensageiros de Deus e protetores dos homens.")],
    ),
    (
        "O que é a salvação?",
        "Catecismo - Teologia",
        [("O que é a salvação?", "A libertação do pecado e da morte por meio de Jesus Cristo.")],
    ),
    (
        "Quem foi São Paulo?",
        "Catecismo - Apóstolos",
        [("Quem foi São Paulo?", "Apóstolo dos Gentios, escreveu várias cartas do Novo Testamento.")],
    ),
    (
        "O que é a Igreja?",
        "Catecismo - Igreja",
        [("O que é a Igreja?", "A comunidade dos batizados, Corpo de Cristo.")],
    ),
    (
        "Qual é o último livro da Bíblia?",
        "Catecismo - Escritura",
        [("Qual é o último livro da Bíblia?", "O Apocalipse.")],
    ),
    (
        "O que é o matrimônio?",
        "Catecismo - Sacramentos",
        [("O que é o matrimônio na Igreja?", "O Sacramento da união entre um homem e uma mulher.")],
    ),
]


def init_db():
    with app.app_context():
        db.create_all()
        if Question.query.count() == 0:
            for title, reference, items in SEED:
                q = Question(title=title, reference=reference)
                db.session.add(q)
                db.session.flush()
                for text, answer in items:
                    db.session.add(SubQuestion(question_id=q.id, text=text, answer=answer))
            db.session.commit()
            print("Banco de dados criado e perguntas semeadas.")


init_db()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/game")
def game():
    return render_template("game.html")


@app.route("/scores")
def scores():
    return render_template("scores.html")


@app.route("/api/questions/random")
def api_random_question():
    total = SubQuestion.query.count()
    if total == 0:
        return jsonify({"error": "sem perguntas"}), 404
    offset = random.randrange(total)
    sq = SubQuestion.query.offset(offset).first()
    others = (
        SubQuestion.query.filter(SubQuestion.id != sq.id)
        .order_by(db.func.random())
        .limit(3)
        .all()
    )
    options = [sq.answer] + [o.answer for o in others]
    random.shuffle(options)
    return jsonify({"id": sq.id, "text": sq.text, "options": options})


@app.route("/api/answer", methods=["POST"])
def api_answer():
    data = request.get_json(force=True) or {}
    sq_id = data.get("sub_question_id")
    chosen = data.get("chosen", "").strip()
    sq = SubQuestion.query.get(sq_id)
    if not sq:
        return jsonify({"correct": False, "error": "pergunta não encontrada"}), 404
    correct = chosen == sq.answer
    points = 25 if correct else -10
    return jsonify({"correct": correct, "points": points, "answer": sq.answer})


@app.route("/api/score", methods=["POST"])
def api_score():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "Anônimo").strip()[:100]
    try:
        points = int(data.get("points", 0))
    except (TypeError, ValueError):
        points = 0
    score = Score(name=name, points=points)
    db.session.add(score)
    db.session.commit()
    return jsonify({"ok": True, "score": score.to_dict()})


@app.route("/api/scores")
def api_scores():
    rows = Score.query.order_by(Score.points.desc(), Score.created_at.asc()).limit(10).all()
    return jsonify([r.to_dict() for r in rows])


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
