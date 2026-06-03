update menu_content.menu_catalog_sections
set title = case title
  when 'Desayuno/Merienda' then 'Cafeteria'
  when 'Promociones desayuno/merienda' then 'Promociones cafeteria'
  else title
end
where title in (
  'Desayuno/Merienda',
  'Promociones desayuno/merienda'
);
