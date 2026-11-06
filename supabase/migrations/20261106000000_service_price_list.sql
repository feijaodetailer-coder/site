-- Requested price list. Archive old offerings to preserve historical service IDs.
BEGIN;
CREATE TEMP TABLE requested_catalog (category text, name text, price integer, duration integer, booking_duration integer, description text) ON COMMIT DROP;
INSERT INTO requested_catalog VALUES
('Limpeza','Limpeza técnica + proteção · Hatch, SUV e Sedan',10000,300,30,'Limpeza técnica + proteção. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Limpeza','Limpeza técnica + proteção · Caminhonete',16000,300,30,'Limpeza técnica + proteção. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Polimento e proteção','Polimento comercial · Hatch, SUV e Sedan',40000,1440,30,'Polimento comercial. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Polimento e proteção','Polimento comercial · Caminhonete',60000,1440,30,'Polimento comercial. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Polimento e proteção','Polimento técnico · Hatch, SUV e Sedan',70000,2880,30,'Polimento técnico. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Polimento e proteção','Polimento técnico · Caminhonete',100000,2880,30,'Polimento técnico. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Polimento e proteção','Vitrificação de pintura · Hatch, SUV e Sedan',100000,2880,30,'Vitrificação de pintura. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Polimento e proteção','Vitrificação de pintura · Caminhonete',140000,2880,30,'Vitrificação de pintura. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Polimento e proteção','Vitrificação full · Hatch, SUV e Sedan',140000,2880,30,'Vitrificação full. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Polimento e proteção','Vitrificação full · Caminhonete',170000,2880,30,'Vitrificação full. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Limpeza','Lavagem detalhada · Hatch, SUV e Sedan',16000,240,30,'Lavagem detalhada. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Limpeza','Lavagem detalhada · Caminhonete',22000,240,30,'Lavagem detalhada. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Tratamentos','Higienização interna — couro · Hatch, SUV e Sedan',38000,180,30,'Higienização interna — couro. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Tratamentos','Higienização interna — couro · Caminhonete',45000,180,30,'Higienização interna — couro. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Tratamentos','Higienização interna — tecido · Hatch, SUV e Sedan',50000,300,30,'Higienização interna — tecido. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Tratamentos','Higienização interna — tecido · Caminhonete',56000,300,30,'Higienização interna — tecido. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Tratamentos','Tratamento de motor · Hatch, SUV e Sedan',18000,240,30,'Tratamento de motor. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Tratamentos','Tratamento de motor · Caminhonete',25000,240,30,'Tratamento de motor. Tempo de execução estimado, confirmado após avaliação do veículo.'),
('Adicionais','Remoção de chuva ácida',5000,120,30,'Remoção de chuva ácida. Mesmo valor para hatch, SUV, sedan e caminhonete. Tempo de execução confirmado após avaliação.'),
('Adicionais','Limpeza de forro de teto',12000,180,30,'Limpeza de forro de teto. Mesmo valor para hatch, SUV, sedan e caminhonete. Tempo de execução confirmado após avaliação.'),
('Adicionais','Limpeza de bancos de couro',10000,180,30,'Limpeza de bancos de couro. Mesmo valor para hatch, SUV, sedan e caminhonete. Tempo de execução confirmado após avaliação.'),
('Adicionais','Limpeza de bancos de tecido',16000,300,30,'Limpeza de bancos de tecido. Mesmo valor para hatch, SUV, sedan e caminhonete. Tempo de execução confirmado após avaliação.'),
('Adicionais','Revitalização de plásticos internos',2000,60,30,'Revitalização de plásticos internos. Mesmo valor para hatch, SUV, sedan e caminhonete. Tempo de execução confirmado após avaliação.'),
('Adicionais','Revitalização de plásticos externos',1500,60,30,'Revitalização de plásticos externos. Mesmo valor para hatch, SUV, sedan e caminhonete. Tempo de execução confirmado após avaliação.'),
('Adicionais','Revitalização de plásticos full',3000,60,30,'Revitalização de plásticos full. Mesmo valor para hatch, SUV, sedan e caminhonete. Tempo de execução confirmado após avaliação.'),
('Adicionais','Polimento de peça',5000,60,30,'Polimento de peça. Mesmo valor para hatch, SUV, sedan e caminhonete. Tempo de execução confirmado após avaliação.'),
('Adicionais','Polimento de farol',15000,120,30,'Polimento de farol. Mesmo valor para hatch, SUV, sedan e caminhonete. Tempo de execução confirmado após avaliação.'),
('Adicionais','Restauração de farol',32000,180,30,'Restauração de farol. Mesmo valor para hatch, SUV, sedan e caminhonete. Tempo de execução confirmado após avaliação.');
UPDATE public.services SET archived = true WHERE category NOT IN ('Pacotes', 'Planos mensais');
UPDATE public.services s SET price = r.price, duration = r.duration, booking_duration = r.booking_duration, description = r.description, archived = false
FROM requested_catalog r WHERE s.name = r.name AND s.category = r.category;
INSERT INTO public.services (category,name,price,duration,booking_duration,description)
SELECT r.category,r.name,r.price,r.duration,r.booking_duration,r.description FROM requested_catalog r
-- Empty installations are initialized by the complete seed, including packages and plans.
WHERE EXISTS (SELECT 1 FROM public.services)
AND NOT EXISTS (SELECT 1 FROM public.services s WHERE s.name = r.name AND s.category = r.category);
COMMIT;
