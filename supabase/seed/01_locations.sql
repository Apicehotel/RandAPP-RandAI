-- Luoghi (camere e zone) delle 3 strutture, presi dalla vecchia app. 478 righe.
-- Da eseguire DOPO le migrazioni (0011). Ripetibile: i luoghi già presenti non vengono toccati.
insert into randapp.hotel_locations (hotel_id,kind,name,group_name,aliases,sort_order)
select * from (values
('chocohotel','zone','Hall Chocohotel',null,'{"Hall"}',97),
('chocohotel','zone','Giardino 1 piano',null,'{"Giardino","Pratone"}',107),
('chocohotel','zone','Parcheggio 1 Piano',null,'{}',108),
('chocohotel','zone','Isola dei golosi',null,'{"Colazione","Sala Colazione"}',109),
('hotelgio','zone','Giardino Jazz',null,'{"giardino jazz","giardino j","verde jazz"}',203),
('hotelgio','zone','Hall Jazz',null,'{"hall jazz","ingresso jazz","reception jazz","hall j","hall"}',204),
('hotelgio','zone','Ufficio Alberto',null,'{"ufficio alberto","stanza alberto","alberto"}',205),
('hotelgio','zone','Ufficio Paolo',null,'{"ufficio paolo","stanza paolo","paolo"}',206),
('hotelgio','zone','Reception',null,'{"Recepion","accoglienza"}',207),
('hotelgio','zone','Back Office Reception',null,'{"Dietro la reception","dietro accoglienza","backoffice","back Office"}',208),
('hotelgio','zone','Bagni Hall Donne',null,'{"bagno hall donne","bagni donne hall","toilette hall donne"}',209),
('hotelgio','zone','Bagni Hall Uomini',null,'{"bagno hall uomini","bagni uomini hall","toilette hall uomini"}',210),
('hotelgio','zone','Piano',null,'{"piano","sala piano","pianoforte"}',211),
('hotelgio','zone','Drums',null,'{"drums","batteria","sala batteria"}',212),
('hotelgio','zone','Guitar',null,'{"guitar","chitarra","sala chitarra"}',213),
('hotelgio','zone','Office 1 Jazz',null,'{"Primo jazz","1 jazz","1jazz","ufficio primo jazz"}',214),
('hotelgio','zone','Corridoio 1 Jazz',null,'{}',215),
('hotelgio','zone','Terrazza 1 Jazz',null,'{"terrazza primo","terrazzo 1","dehors"}',216),
('hotelgio','zone','Office 2 Jazz',null,'{"Secondo jazz","2 jazz","2jazz","ufficio secondo jazz"}',217),
('hotelgio','zone','Corridoio 2 Jazz',null,'{}',218),
('hotelgio','zone','Office 3 Jazz',null,'{"Terzo jazz","3 jazz","3jazz","ufficio terzo jazz"}',219),
('hotelgio','zone','Corridoio 3 Jazz',null,'{}',220),
('hotelgio','zone','Office 4 Jazz',null,'{"Quarto jazz","4 jazz","4jazz","ufficio quarto jazz"}',221),
('hotelgio','zone','Corridoio 4 Jazz',null,'{"corridoio 4 jazz","4 paino jazz","4piano jazz","piano4 jazz"}',222),
('hotelgio','zone','Terrazza 4 Jazz',null,'{"terrazza quarto","terrazzo quarto","dehors quarto"}',223),
('hotelgio','zone','Piscina',null,'{"pool","5 piano","quinto piano","5piano"}',224),
('hotelgio','zone','-1 Jazz',null,'{"meno 1 jazz","meno uno jazz","-1 jazz","piano meno 1 jazz"}',225),
('hotelgio','zone','Parcheggio -1 Jazz',null,'{"parcheggio meno 1 jazz","parcheggio -1","garage meno 1 jazz"}',226),
('hotelgio','zone','Corridoio -1',null,'{}',227),
('hotelgio','zone','Bagni - 1 Jazz Donne',null,'{"bagno meno 1 jazz donne","bagni -1 donne jazz"}',228),
('hotelgio','zone','Bagni - 1 Jazz Uomini',null,'{"bagno meno 1 jazz uomini","bagni -1 uomini jazz"}',229),
('hotelgio','zone','Cool',null,'{"cool","sala cool"}',230),
('hotelgio','zone','Bagni Cool Donne',null,'{"bagno cool donne","bagni donne cool"}',231),
('hotelgio','zone','Bagni Cool Uomini',null,'{"bagno cool uomini","bagni uomini cool"}',232),
('hotelgio','zone','Preservation',null,'{"preservation","sala preservation"}',233),
('hotelgio','zone','Sala Colazioni',null,'{"colazioni","sala colazione","breakfast","sala breakfast"}',234),
('hotelgio','zone','Breakfast 1',null,'{"breakfast 1","colazione 1","sala breakfast 1"}',235),
('hotelgio','zone','Breakfast 2',null,'{"breakfast 2","colazione 2","sala breakfast 2"}',236),
('hotelgio','zone','-2 Jazz',null,'{"meno 2 jazz","meno due jazz","-2 jazz","piano meno 2 jazz"}',237),
('hotelgio','zone','Parcheggio -2 Jazz',null,'{"parcheggio meno 2 jazz","parcheggio -2","garage meno 2 jazz"}',238),
('hotelgio','zone','Corridoio -2',null,'{}',239),
('hotelgio','zone','Bagni -2 Jazz Donne',null,'{"bagno meno 2 jazz donne","bagni -2 donne jazz"}',240),
('hotelgio','zone','Bagni -2 Jazz Uomini',null,'{"bagno meno 2 jazz uomini","bagni -2 uomini jazz"}',241),
('hotelgio','zone','Magazzino Elettronico',null,'{"magazzino elettronico","deposito elettronico"}',242),
('hotelgio','zone','Magazzino Idrailico',null,'{"magazzino idraulico","deposito idraulico"}',243),
('hotelgio','zone','Magazzino Tavoli',null,'{"magazzino tavoli","deposito tavoli"}',244),
('hotelgio','zone','Sax',null,'{"sax","sassofono","sala sax"}',245),
('hotelgio','zone','Trumpet',null,'{"trumpet","tromba","sala tromba"}',246),
('hotelgio','zone','Auditorium',null,'{"auditorium","sala auditorium"}',247),
('hotelgio','zone','Auditorium Bagni Donne',null,'{"bagno auditorium donne","bagni donne auditorium"}',248),
('hotelgio','zone','Auditorium Bagni Uomini',null,'{"bagno auditorium uomini","bagni uomini auditorium"}',249),
('hotelgio','zone','Parcheggio -3 Jazz',null,'{"garage","-3"}',250),
('hotelgio','zone','Giardino Wine',null,'{"giardino","verde","aiuole","esterno"}',251),
('hotelgio','zone','Hall Wine',null,'{"hall wine","ingresso wine","reception wine","hall w"}',252),
('hotelgio','zone','Scale Auditorium',null,'{"scale auditorium","scala auditorium"}',253),
('hotelgio','zone','Office Wine',null,'{"office wine","ufficio wine","back office wine","office hall wine"}',254),
('hotelgio','zone','Lavanderia Wine',null,'{"lavanderia","stireria","laundry"}',255),
('hotelgio','zone','Risto Wine',null,'{"risto wine","ristorante wine","sala ristorante wine"}',258),
('hotelgio','zone','Sala Cravatte',null,'{"sala cravatte","cravatte"}',259),
('hotelgio','zone','Sala Fontivegge',null,'{"sala fontivegge","fontivegge"}',260),
('hotelgio','zone','Sala Vinarelli',null,'{"sala vinarelli","vinarelli"}',261),
('hotelgio','zone','Sala Etichette',null,'{"sala etichette","etichette"}',262),
('hotelgio','zone','Office 1 Wine',null,'{"Primo wine","1 wine","1wine","ufficio primo wine"}',263),
('hotelgio','zone','Corridoio 1 Wine',null,'{}',264),
('hotelgio','zone','Office 2 Wine',null,'{"Secondo wine","2 wine","2wine","ufficio secondo wine"}',265),
('hotelgio','zone','Corridoio 2 Wine',null,'{}',266),
('hotelgio','zone','Office 3 Wine',null,'{"Terzo wine","3 wine","3wine","ufficio terzo wine"}',267),
('hotelgio','zone','Corridoio 3 Wine',null,'{}',268),
('hotelgio','zone','Office 4 Wine',null,'{"Quarto wine","4 wine","4wine","ufficio quarto wine"}',269)
) as s(hotel_id,kind,name,group_name,aliases,sort_order)
union all select 'brigantino','room',x.n,'P1 Brigantino','{}'::text[],1+x.i-1 from unnest(array['101','102','103','104','105','106','107','108','109','110','111','112','113','114','115','116','117','118','119','120','121','122','123','124']) with ordinality as x(n,i)
union all select 'brigantino','room',x.n,'P2 Brigantino','{}'::text[],25+x.i-1 from unnest(array['201','202','203','204','205','206','207','208','209','210','211','212','213','214','215','216','217','218','219','220','221','222','223','224']) with ordinality as x(n,i)
union all select 'brigantino','room',x.n,'Case','{}'::text[],49+x.i-1 from unnest(array['Casa 1','Casa 2','Casa 3','Casa 4']) with ordinality as x(n,i)
union all select 'brigantino','room',x.n,'Appartamento','{}'::text[],53+x.i-1 from unnest(array['Appartamento 1','Appartamento 2']) with ordinality as x(n,i)
union all select 'brigantino','zone',x.n,null,'{}'::text[],55+x.i-1 from unnest(array['Hall','Bar Hall','Saletta Hall','Sala Hall','Sala Colazioni','Parcheggio Frontale','Parcheggio Spiaggia','Spiaggia','Cucina Colazioni','Corridoio Piano 1','Corridoio Piano 2','Scale Esterne','Terrazzo Mare','Piscina']) with ordinality as x(n,i)
union all select 'chocohotel','room',x.n,'P2 Chocohotel','{}'::text[],1+x.i-1 from unnest(array['201','202','203','204','205','206','207','208','209','210','211','212','213','214','215','216','217','218','219','220','221','222','223','224','225','226','227','228','229','230','231','232']) with ordinality as x(n,i)
union all select 'chocohotel','room',x.n,'P3 Chocohotel','{}'::text[],33+x.i-1 from unnest(array['301','302','303','304','305','306','307','308','309','310','311','312','313','314','315','316','317','318','319','320','321','322','323','324','325','326','327','328','329','330','331','332']) with ordinality as x(n,i)
union all select 'chocohotel','room',x.n,'P4 Chocohotel','{}'::text[],65+x.i-1 from unnest(array['401','402','403','404','405','406','407','408','409','410','411','412','413','414','415','416','417','418','419','420','421','422','423','424','425','426','427','428','429','430']) with ordinality as x(n,i)
union all select 'chocohotel','zone',x.n,null,'{}'::text[],95+x.i-1 from unnest(array['Parcheggio Hall','Ingresso Hall']) with ordinality as x(n,i)
union all select 'chocohotel','zone',x.n,null,'{}'::text[],98+x.i-1 from unnest(array['Bagni Uomini Hall','Bagni Donne Hall','Choco Store','Sala Fondente 1','Sala Fondente 2','Sala Gianduia','Sala','Sala Latte','Locale Caldaie']) with ordinality as x(n,i)
union all select 'chocohotel','zone',x.n,null,'{}'::text[],110+x.i-1 from unnest(array['Office 2 Chocohotel','Corridoio 2 Chocohotel','Office 3 Chocohotel','Corridoio 3 Chocohotel','Office 4 Chocohotel','Corridoio 4 Chocohotel','Piscina','Giardino Piscina','Office Piscina','-1 Chocohotel','Garage -1 Chocohotel']) with ordinality as x(n,i)
union all select 'hotelgio','room',x.n,'Jazz P1','{}'::text[],1+x.i-1 from unnest(array['1101','1102','1103','1104','1105','1106','1107','1108','1109','1110','1111','1112','1114','1115','1116','1118','1119','1120','1121']) with ordinality as x(n,i)
union all select 'hotelgio','room',x.n,'Jazz P2','{}'::text[],20+x.i-1 from unnest(array['2201','2202','2203','2204','2205','2206','2207','2208','2209','2210','2211','2212','2214','2215','2216','2218','2219','2220','2221']) with ordinality as x(n,i)
union all select 'hotelgio','room',x.n,'Jazz P3','{}'::text[],39+x.i-1 from unnest(array['3301','3302','3303','3304','3305','3306','3307','3308','3309','3310','3311','3312','3314','3315','3316','3318','3319','3320','3321']) with ordinality as x(n,i)
union all select 'hotelgio','room',x.n,'Jazz P4','{}'::text[],58+x.i-1 from unnest(array['4401','4402','4403','4404','4405','4406','4407','4408','4409','4410','4411','4412','4414','4415','4416','4418','4419','4420','4421']) with ordinality as x(n,i)
union all select 'hotelgio','room',x.n,'Wine P1','{}'::text[],77+x.i-1 from unnest(array['101','102','103','104','105','106','107','108','109','110','111','112','113','114','115','116','117','119','120','121','122','123','124','125','126','127','128','129','130','131']) with ordinality as x(n,i)
union all select 'hotelgio','room',x.n,'Wine P2','{}'::text[],107+x.i-1 from unnest(array['201','202','203','204','205','206','207','208','209','210','211','212','213','214','216','217','218','219','220','221','222','223','224','225','226','227','228','229','230','231','232','233']) with ordinality as x(n,i)
union all select 'hotelgio','room',x.n,'Wine P3','{}'::text[],139+x.i-1 from unnest(array['301','302','303','304','305','306','307','308','309','310','311','312','313','314','315','317','318','319','320','321','322','323','324','325','326','327','328','329','330','331','332']) with ordinality as x(n,i)
union all select 'hotelgio','room',x.n,'Wine P4','{}'::text[],170+x.i-1 from unnest(array['401','402','403','404','405','406','407','408','409','410','411','412','413','414','415','417','418','419','420','421','422','423','424','425','426','427','428','429','430','431','432','433','434']) with ordinality as x(n,i)
union all select 'hotelgio','zone',x.n,null,'{}'::text[],256+x.i-1 from unnest(array['Cantina','Gusto']) with ordinality as x(n,i)
union all select 'hotelgio','zone',x.n,null,'{}'::text[],270+x.i-1 from unnest(array['Corridoio 4 Wine','Ascensore Sinistra Jazz','Ascensore Destra Jazz','Ascensore Staff Jazz','Ascensore Paronamico Wine','Ascensore Centrale Wine','Ascensore Staff Wine','Centro Congressi','Palestra','Corridoio Palestra','Scale Wine','Scale Jazz Piccole','Scale Jazz Grandi','1 jazz','2 jazz','3 jazz','4 jazz','1 wine','2 wine','3 wine','4 wine']) with ordinality as x(n,i)
on conflict do nothing;