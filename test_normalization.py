from backend.app.services.normalization import normalize_model_name


def _t(inp: str, expected: str):
    out = normalize_model_name(inp)
    assert out == expected, f"{inp!r} -> {out!r} (expected {expected!r})"


def test_rules():
    # 1) Uppercase + Ё->Е
    _t("насос ёжик", "НАСОС-ЕЖИК")

    # 2) Comma between digits -> dot (and commas in general -> dots)
    _t("АВС 12,5 3,2", "АВС12.5-3.2")

    # 3/4/7) Between digit<->letter remove any separators/spaces
    _t("НАСОС-12 / А", "НАСОС12А")

    # 5/8) Between digit-digit non-dot separator -> hyphen; space -> hyphen
    _t("МОД 12 34", "МОД12-34")
    _t("МОД 12/34", "МОД12-34")

    # 6/8) Between letter-letter any separator/space -> hyphen
    _t("ЭЛЕКТРО ДВИГАТЕЛЬ_АСИНХР", "ЭЛЕКТРО-ДВИГАТЕЛЬ-АСИНХР")

    # 10) № + digits -> parentheses at end, commas already become dots
    _t("УКДТ654-02П-№2,5", "УКДТ654-02П(№2.5)")

    # 8.3.10 clarification: Latin lookalikes must become Cyrillic (P->Р by visual similarity)
    _t("ПP-12", "ПР12")

    # Provided examples (regression)
    cases = [
        ("ПРГ-160", "ПРГ160"),
        ("GA 37-7,5P", "GA37-7.5P"),
        ("GA30-10", "GA30-10"),
        ("T 19 V800-1", "T19V800-1"),
        ("T 19 V800-2", "T19V800-2"),
        ("MNSH 200", "MNSH200"),
        ("ДК 112-80-2,2_220", "ДК112-80-2.2-220"),
        ("ДК 112-90-3,0_220", "ДК112-90-3.0-220"),
        ("ДКУ 112-120-3,0_110", "ДКУ112-120-3.0-110"),
        ("ДКУ 112-90-3,0__220", "ДКУ112-90-3.0-220"),
        ("S3CB-H070410-SS", "S3CB-H070410SS"),
        ("Д 160 112/а", "Д160-112А"),
        ("Д 200-36/Б", "Д200-36Б"),
        ("1 Д200-90/а", "1Д200-90А"),
        ("Д  160-112/Б", "Д160-112Б"),
        ("MX -04A-PAC/1", "MX04A-PAC1"),
        ("K37 R-AQA80/1", "K37R-AQA80-1"),
        ("R67 AQH80/1", "R67AQH80-1"),
        ("SEPREMIUM 30/RS", "SEPREMIUM30RS"),
        ("UFS-SP30N", "UFS-SP30N"),
        ("UFS-SP120N", "UFS-SP120N"),
        ("MML 2550-M", "MML2550M"),
        ("WT-MNT PREDOS", "WT-MNT-PREDOS"),
        ("PKF 2,0", "PKF2.0"),
        ("FMA 2004", "FMA2004"),
        ("FMA 2006", "FMA2006"),
        ("FMA 2012", "FMA2012"),
        ("ARKAL 4*2", "ARKAL4-2"),
        ("WTMNTF 97-Ι", "WTMNTF97-Ι"),
    ]
    for inp, expected in cases:
        _t(inp, expected)


if __name__ == "__main__":
    test_rules()
    print("OK")
