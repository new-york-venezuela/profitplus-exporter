IF NOT EXISTS (SELECT 1 FROM saTipoAjuste WHERE co_tipo = 'E00003')
    INSERT INTO saTipoAjuste (co_tipo, des_tipo, tipo_trans, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo)
    VALUES ('E00003', 'Ajuste Por Conteo Manual (Sobrante)', '0', 'PROFIT', NULL, GETDATE(), 'PROFIT', NULL, GETDATE());

IF NOT EXISTS (SELECT 1 FROM saTipoAjuste WHERE co_tipo = 'S00005')
    INSERT INTO saTipoAjuste (co_tipo, des_tipo, tipo_trans, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo)
    VALUES ('S00005', 'Ajuste Por Conteo Manual (Faltante)', '1', 'PROFIT', NULL, GETDATE(), 'PROFIT', NULL, GETDATE());
