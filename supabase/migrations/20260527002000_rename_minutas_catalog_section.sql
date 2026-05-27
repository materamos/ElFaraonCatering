begin;

update menu_content.menu_catalog_sections
set title = 'Tartas, tortillas y omelettes'
where section_id = 'minutas-tartas-omelettes'
  and title <> 'Tartas, tortillas y omelettes';

commit;
