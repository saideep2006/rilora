-- Approved baseline content from the RILORA requirements; no vacancies or unverified claims are seeded.
insert into public.projects(slug,name,category,description,status,image_url,collaboration,is_published) values
('rilora-messaging','RILORA Messaging Application','RILORA product','RILORA messaging application project. Public product details are forthcoming.','Details forthcoming','/brand/rilora-messaging.jpeg',null,true),
('healthcare-management','Healthcare Management Application','Healthcare technology','A healthcare technology project developed in collaboration with CureTrics.','Details forthcoming','/brand/rilora-curetrics.jpeg','CureTrics',true)
on conflict(slug) do nothing;

insert into public.services(slug,name,description,is_published,sort_order) values
('startup-website-development','Startup Website Development','Professional websites for startups and emerging businesses.',true,1),
('corporate-website-development','Corporate Website Development','Modern websites for established organisations.',true,2),
('portfolio-personal-websites','Portfolio and Personal Websites','Personal and portfolio websites that present your work clearly.',true,3),
('business-landing-pages','Business Landing Pages','Focused landing pages for business goals and campaigns.',true,4),
('web-application-development','Web Application Development','Web applications built around your users and requirements.',true,5),
('custom-digital-solutions','Custom Digital Solutions','Digital tools and platforms shaped around your needs.',true,6),
('ui-ux-website-design','UI/UX and Website Design','User-focused interface and website design.',true,7),
('website-maintenance-improvements','Website Maintenance and Improvements','Ongoing website maintenance and iterative improvements.',true,8)
on conflict(slug) do nothing;

insert into public.site_content(content_key,content_value) values
('home_headline','Building Digital Experiences. Empowering Future Innovators.'),
('home_subtitle','From startup websites to innovative applications, RILORA transforms ideas into digital experiences while creating opportunities for talented individuals to learn, contribute and grow.'),
('about_intro','RILORA is a technology and digital solutions company focused on building modern websites, developing digital products and helping ideas grow into meaningful technology solutions.'),
('careers_intro','Have a passion for technology, creativity or business? Explore administrator-published opportunities to contribute to projects and build practical experience.'),
('services_intro','We help startups and growing businesses establish their digital presence through modern websites and innovative technology solutions.')
on conflict(content_key) do nothing;

insert into public.partnerships(slug,name,description,logo_url,is_published) values
('curetrics','CureTrics','Confirmed collaboration with RILORA on the Healthcare Management Application.','/brand/rilora-curetrics.jpeg',true)
on conflict(slug) do nothing;
