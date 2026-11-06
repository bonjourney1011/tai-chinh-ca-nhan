"""Contract tests: CSV schemas and Sheet headers stay consistent."""

from taichinh.sheets import tabs
from taichinh.store import schemas


def test_every_csv_schema_has_provenance_and_keys_in_columns():
    for s in schemas.ALL_SCHEMAS.values():
        assert set(schemas.PROVENANCE) <= set(s.columns)
        assert set(s.keys) <= set(s.columns)
        assert len(set(s.columns)) == len(s.columns)


def test_every_tab_has_headers_and_unique_columns():
    for tab in (*tabs.INPUT_TABS, *tabs.RESULT_TABS):
        cols = tabs.HEADERS[tab]
        assert cols, tab
        assert len(set(cols)) == len(cols), tab


def test_input_and_result_tabs_do_not_overlap():
    assert not set(tabs.INPUT_TABS) & set(tabs.RESULT_TABS)
