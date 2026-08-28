CREATE TABLE IF NOT EXISTS profiles (
    user_id   BIGINT PRIMARY KEY REFERENCES users(id),
    handle    TEXT NOT NULL,
    bio       TEXT NOT NULL,
    interests TEXT[] NOT NULL DEFAULT '{}'
);

-- The cast: named people with faces, bios, and things they want to do.
UPDATE users SET display_name = v.n FROM (VALUES
 (281,'Sofia Marchetti'),(321,'Kenji Watanabe'),(361,'Rosa Delgado'),
 (401,'Nora Bloom'),(441,'Amir Haddad'),(481,'Ellis Park'),(521,'Tunde Adeyemi')
) AS v(id, n) WHERE users.id = v.id;

INSERT INTO profiles (user_id, handle, bio, interests) VALUES
 (1,  '@margaret.knits', 'Crossword fiend, soup evangelist, been at the Thursday lunch table for eleven years.', '{crosswords,soup club,slow walks}'),
 (41, '@ray.walks', 'Six thousand steps before breakfast. Will talk baseball with anyone who sits still.', '{morning walks,baseball talk,coffee}'),
 (81, '@alma.plaza', 'Retired teacher. Runs on plaza gossip and jasmine tea.', '{tea,book swaps,people watching}'),
 (121,'@hector.cards', 'Cribbage shark, gentle about it. Brings the good snacks.', '{cards,dominoes,snack diplomacy}'),
 (161,'@june.sketches', 'Sketchbook always in the tote. Draws the fountain more than the fountain deserves.', '{urban sketching,museum trips,picnics}'),
 (201,'@priya.gardens', 'Community plot #14. Chronically gives away zucchini.', '{gardening,seed swaps,farmers markets}'),
 (241,'@walt.chess', 'Plays slow chess and fast checkers. Retired ferry engineer, full of bridge facts.', '{chess,ferry rides,history walks}'),
 (281,'@sofia.pasta', 'Makes pasta from scratch on Sundays and always cooks for eight.', '{cooking,sunday lunches,opera radio}'),
 (321,'@kenji.birds', 'Knows every heron in the marina by attitude. Binoculars to lend.', '{birdwatching,photography,early mornings}'),
 (361,'@rosa.baila', 'Danced professionally in another life. Teaches anyone with two left feet.', '{dancing,live music,mercado runs}'),
 (401,'@nora.pages', 'Reads two books a week and needs someone to argue about them with.', '{book club,libraries,rainy afternoons}'),
 (441,'@amir.chai', 'Pours the best chai north of the park. Believes benches are social infrastructure.', '{chai,backgammon,bench philosophy}'),
 (481,'@ellis.tides', 'Swims the bay on Saturdays, warm water optional.', '{bay swims,saunas,tide charts}'),
 (521,'@tunde.strings', 'Guitar on the porch most evenings. Requests welcome, tuning optional.', '{guitar,porch sessions,record shops}')
ON CONFLICT (user_id) DO UPDATE SET handle = EXCLUDED.handle, bio = EXCLUDED.bio, interests = EXCLUDED.interests;

-- Their upcoming plans, so profile pages have a future.
INSERT INTO activities (host_id, org_id, title, starts_at, duration_min, place_label, capacity, lat, lng)
SELECT v.host, 1, v.title, now() + v.off, 90, v.place, v.cap,
       u.lat + 0.001, u.lng + 0.001
FROM (VALUES
 (161, 'Sketching the fountain, loaner pencils', interval '1 day 3 hours', 'Peace Plaza fountain', 6),
 (201, 'Seed swap and zucchini offload', interval '2 days 5 hours', 'Community garden gate', 8),
 (241, 'Slow chess, fast checkers', interval '3 days 2 hours', 'Senior center common room', 4),
 (281, 'Sunday pasta, table for eight', interval '4 days 6 hours', 'Center kitchen', 8),
 (321, 'Marina heron walk, binoculars provided', interval '2 days 1 hour', 'Marina green flagpole', 5),
 (361, 'Two left feet welcome: first steps', interval '5 days 4 hours', 'Center hall', 10),
 (441, 'Chai and backgammon on the benches', interval '1 day 6 hours', 'Japantown benches', 4),
 (521, 'Porch guitar, requests welcome', interval '6 days 2 hours', 'Center courtyard', 12)
) AS v(host, title, off, place, cap)
JOIN users u ON u.id = v.host
WHERE NOT EXISTS (SELECT 1 FROM activities a WHERE a.host_id = v.host AND a.title = v.title);
