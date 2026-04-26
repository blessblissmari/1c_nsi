"""Тесты карточек узлов иерархии и классификатора + автоназначение класса."""

from __future__ import annotations


def _auth_headers(client) -> dict[str, str]:
    client.post(
        "/api/v1/auth/register",
        json={"email": "admin@example.com", "password": "secret123", "full_name": "Admin"},
    )
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "secret123"},
    )
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _seed_minimal(client, headers):
    """Создаёт класс «Насосы» с подклассом «Центробежные», узел иерархии и модель."""
    cls = client.post(
        "/api/v1/hierarchy/classes",
        json={"name": "Насосы"},
        headers=headers,
    ).json()
    sub = client.post(
        "/api/v1/hierarchy/subclasses",
        json={"name": "Центробежные", "class_id": cls["id"]},
        headers=headers,
    ).json()
    node = client.post(
        "/api/v1/hierarchy/nodes",
        json={"name": "Линия подачи", "level_type": "Уровень 5"},
        headers=headers,
    ).json()
    model = client.post(
        "/api/v1/hierarchy/models",
        json={"original_name": "Д 160 112/а", "hierarchy_id": node["id"]},
        headers=headers,
    ).json()
    return cls, sub, node, model


def test_classes_list_returns_counts(client):
    headers = _auth_headers(client)
    _cls, sub, _node, model = _seed_minimal(client, headers)
    # Привязываем модель к классу/подклассу.
    client.post(
        f"/api/v1/hierarchy/models/{model['id']}/classify",
        json={"class_name": "Насосы", "subclass_name": "Центробежные"},
        headers=headers,
    )

    r = client.get("/api/v1/hierarchy/classes", headers=headers)
    assert r.status_code == 200, r.text
    classes = r.json()
    assert len(classes) == 1
    pumps = classes[0]
    assert pumps["name"] == "Насосы"
    assert pumps["model_count"] == 1
    assert pumps["subclass_counts"][str(sub["id"])] == 1


def test_class_card_returns_models_and_subclasses(client):
    headers = _auth_headers(client)
    cls, sub, _node, model = _seed_minimal(client, headers)
    client.post(
        f"/api/v1/hierarchy/models/{model['id']}/classify",
        json={"class_name": "Насосы", "subclass_name": "Центробежные"},
        headers=headers,
    )

    r = client.get(
        f"/api/v1/hierarchy/classes/{cls['id']}/card",
        params={"subclass_id": sub["id"]},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    card = r.json()
    assert card["name"] == "Насосы"
    assert card["subclass_name"] == "Центробежные"
    assert card["model_count"] == 1
    assert any(m["id"] == model["id"] for m in card["sample_models"])


def test_node_card_counts_descendants_and_models(client):
    headers = _auth_headers(client)
    _cls, _sub, parent, _model = _seed_minimal(client, headers)
    child = client.post(
        "/api/v1/hierarchy/nodes",
        json={"name": "Агрегат 1", "level_type": "Уровень 6", "parent_id": parent["id"]},
        headers=headers,
    ).json()
    client.post(
        "/api/v1/hierarchy/models",
        json={"original_name": "Д 200-36/Б", "hierarchy_id": child["id"]},
        headers=headers,
    )

    r = client.get(f"/api/v1/hierarchy/nodes/{parent['id']}/card", headers=headers)
    assert r.status_code == 200, r.text
    card = r.json()
    assert card["children_count"] == 1
    assert card["descendants_count"] == 1
    assert card["descendant_models_count"] >= 1


def test_classify_by_name_creates_class_and_subclass(client):
    headers = _auth_headers(client)
    node = client.post(
        "/api/v1/hierarchy/nodes",
        json={"name": "Линия", "level_type": "Уровень 5"},
        headers=headers,
    ).json()
    model = client.post(
        "/api/v1/hierarchy/models",
        json={"original_name": "СД 80/32", "hierarchy_id": node["id"]},
        headers=headers,
    ).json()

    r = client.post(
        f"/api/v1/hierarchy/models/{model['id']}/classify",
        json={"class_name": "Сепараторы", "subclass_name": "Жидкостные"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["class_name"] == "Сепараторы"
    assert detail["subclass_name"] == "Жидкостные"

    classes = client.get("/api/v1/hierarchy/classes", headers=headers).json()
    assert any(c["name"] == "Сепараторы" for c in classes)


def test_classify_by_name_rejects_when_create_disabled(client):
    headers = _auth_headers(client)
    node = client.post(
        "/api/v1/hierarchy/nodes",
        json={"name": "Линия", "level_type": "Уровень 5"},
        headers=headers,
    ).json()
    model = client.post(
        "/api/v1/hierarchy/models",
        json={"original_name": "X-1", "hierarchy_id": node["id"]},
        headers=headers,
    ).json()

    r = client.post(
        f"/api/v1/hierarchy/models/{model['id']}/classify",
        json={"class_name": "Не существует", "create_if_missing": False},
        headers=headers,
    )
    assert r.status_code == 404


def test_model_analogs_endpoint_returns_list(client):
    headers = _auth_headers(client)
    _cls, _sub, node, model = _seed_minimal(client, headers)
    client.post(
        f"/api/v1/hierarchy/models/{model['id']}/classify",
        json={"class_name": "Насосы", "subclass_name": "Центробежные"},
        headers=headers,
    )
    # Создаём вторую похожую модель — должна попасть в аналоги.
    sibling = client.post(
        "/api/v1/hierarchy/models",
        json={"original_name": "Д 160-112/Б", "hierarchy_id": node["id"]},
        headers=headers,
    ).json()
    client.post(
        f"/api/v1/hierarchy/models/{sibling['id']}/classify",
        json={"class_name": "Насосы", "subclass_name": "Центробежные"},
        headers=headers,
    )

    r = client.post(
        f"/api/v1/hierarchy/models/{model['id']}/analogs",
        json={"selected_characteristic_ids": [], "limit": 5},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    items = r.json()
    assert isinstance(items, list)
    assert any(item["model_id"] == sibling["id"] for item in items)
