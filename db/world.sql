-- People across the globe: a circle in each city, scatter members around it,
-- and one named cast person per city with a profile.

CREATE TEMP TABLE _cities (
  org_name TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  cast_name TEXT, handle TEXT, bio TEXT, interests TEXT[]
);
INSERT INTO _cities VALUES
 ('Shoreditch Evening Circle',   51.5245,  -0.0786, 'Beatrice Ammons',  '@bea.allotments', 'Keeps an allotment and three opinions about compost. Tea solves most things.', '{allotments,tea,quiz nights}'),
 ('Shimokitazawa Hours Club',    35.6613, 139.6681, 'Haruto Sasaki',    '@haruto.records', 'Hunts jazz vinyl on weekends. Happy to teach shogi over coffee.', '{jazz vinyl,shogi,coffee}'),
 ('Yaba Neighbours Network',      6.5158,   3.3898, 'Chidinma Eze',     '@chidi.stories', 'Runs a tiny street library. Collects proverbs and long laughs.', '{street library,storytelling,jollof sundays}'),
 ('Vila Madalena Vizinhos',     -23.5537, -46.6923, 'Marcos Ferreira',  '@marcos.chorinho', 'Plays cavaquinho badly and proudly. Sunday feijoada is sacred.', '{chorinho,feijoada,street art walks}'),
 ('Newtown Hours Collective',   -33.8978, 151.1785, 'Iris McAllister',  '@iris.tides', 'Ocean pool swimmer, dawn shift. Knows the best flat white within a mile.', '{ocean pools,flat whites,crosswords}'),
 ('Kreuzberg Stundenkreis',      52.4996,  13.4030, 'Otto Brandt',      '@otto.kiez', 'Fixes bicycles for neighbours and refuses payment beyond cake.', '{bike repair,canal walks,cake economics}'),
 ('Bandra Hours Adda',           19.0596,  72.8295, 'Meera Kulkarni',   '@meera.chai', 'Hosts a rooftop chai adda. Believes gossip is a civic duty.', '{rooftop chai,carrom,sea-face walks}'),
 ('Greenpoint Hours Exchange',   40.7304, -73.9515, 'Sal Moretti',      '@sal.stoop', 'Stoop-sitting professional. Runs a pierogi appreciation society of four.', '{stoop sitting,pierogis,dominoes}'),
 ('Coyoacán Círculo de Horas',   19.3467, -99.1617, 'Lupita Reyes',     '@lupita.plaza', 'Feeds half the plaza, pigeons included. Dances danzón on Thursdays.', '{danzón,mercado mornings,plaza life}'),
 ('Westlands Hours Circle',      -1.2676,  36.8062, 'Baraka Otieno',    '@baraka.chess', 'Street chess regular. Will trade a game for a good story.', '{street chess,nyama choma,long walks}'),
 ('Hongdae Hours Ring',          37.5563, 126.9220, 'Jiwoo Han',        '@jiwoo.sketch', 'Draws strangers kindly in cafés and gives them the page.', '{café sketching,noraebang,night markets}'),
 ('Palermo Ronda de Horas',     -34.5885, -58.4306, 'Nico Alvarez',     '@nico.mate', 'Never without a thermos. Organizes park mate rounds for anyone sitting alone.', '{mate rounds,tango radio,park benches}');

-- one org per city
INSERT INTO orgs (name, kind)
SELECT org_name, 'neighborhood' FROM _cities
WHERE NOT EXISTS (SELECT 1 FROM orgs o WHERE o.name = _cities.org_name);

-- ~30 scatter members per city
INSERT INTO users (display_name, org_id, zip, seeded, lat, lng)
SELECT
  (ARRAY['Ana','Leo','Mia','Omar','Zoe','Tomas','Aya','Nils','Sana','Ravi','Elif','Kofi','Ines','Yuki','Dara','Milan','Noor','Pavel','Lina','Sami'])[1 + (g + abs(hashtext(c.org_name)) ) % 20]
  || ' ' ||
  (ARRAY['Silva','Okoro','Novak','Ito','Haddad','Berg','Costa','Mensah','Petrov','Rao','Duarte','Kim','Alvarez','Moreau','Ndiaye','Weber','Sato','Molnar','Farah','Rossi'])[1 + (g * 7 + abs(hashtext(c.org_name))) % 20],
  o.id, '00000', true,
  c.lat + (abs(hashtext(c.org_name || g || 'a')) % 2000 - 1000) / 1000.0 * 0.012,
  c.lng + (abs(hashtext(c.org_name || g || 'b')) % 2000 - 1000) / 1000.0 * 0.015
FROM _cities c
JOIN orgs o ON o.name = c.org_name
CROSS JOIN generate_series(1, 30) g
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.org_id = o.id);

-- a window or two each, so dots get their color
INSERT INTO availability (user_id, weekday, start_min, end_min, kind, radius_m)
SELECT u.id, abs(hashtext(u.id::text || 'd')) % 7,
       480 + (abs(hashtext(u.id::text || 's')) % 20) * 30,
       600 + (abs(hashtext(u.id::text || 's')) % 20) * 30,
       CASE WHEN abs(hashtext(u.id::text || 'k')) % 2 = 0 THEN 'surplus' ELSE 'deficit' END,
       2000
FROM users u JOIN orgs o ON o.id = u.org_id
WHERE o.name IN (SELECT org_name FROM _cities)
  AND NOT EXISTS (SELECT 1 FROM availability a WHERE a.user_id = u.id);

-- the named cast member per city
INSERT INTO users (display_name, org_id, zip, seeded, lat, lng)
SELECT c.cast_name, o.id, '00000', true, c.lat + 0.002, c.lng + 0.002
FROM _cities c JOIN orgs o ON o.name = c.org_name
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.display_name = c.cast_name);

INSERT INTO profiles (user_id, handle, bio, interests)
SELECT u.id, c.handle, c.bio, c.interests
FROM _cities c JOIN users u ON u.display_name = c.cast_name
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO availability (user_id, weekday, start_min, end_min, kind, radius_m)
SELECT u.id, 6, 600, 780, 'surplus', 2500
FROM _cities c JOIN users u ON u.display_name = c.cast_name
WHERE NOT EXISTS (SELECT 1 FROM availability a WHERE a.user_id = u.id);

DROP TABLE _cities;
