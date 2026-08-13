# SP: pSeleccionarChequeDevueltoVenta
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCaja`](../tables/saCaja.md)
- [`saChequeDevueltoVenta`](../tables/saChequeDevueltoVenta.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarChequeDevueltoVenta
DESCRIPCION: Seleccion de un registro de la tabla bancos
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarChequeDevueltoVenta] ( @sCo_Cheq_Dev CHAR(20) )
AS 
    BEGIN

	--Se revisa si fue automático o manual 
	DECLARE @bTipo BIT
	SET @bTipo = (SELECT automatico FROM saChequeDevueltoVenta WHERE co_cheq_dev = @sCo_Cheq_Dev )


        IF (@bTipo = 0) --Manual
	(
		SELECT DISTINCT 
                       (  cd.co_cheq_dev ), cd.*, '' AS cob_num, cd.cod_caja,
            saBanco.des_ban AS des_ban, 
            '' AS num_doc, @bTipo AS devuelto,
            CAST(0 AS Decimal) AS tasa, '' AS cta_Egre,
            '' AS des_cta, '' AS co_mone, '' AS mov_num_b, cd.automatico, cd.cod_cta
		FROM            dbo.saChequeDevueltoVenta AS cd INNER JOIN
                         dbo.saCliente ON dbo.saCliente.co_cli = cd.co_cli INNER JOIN
                         dbo.saBanco ON cd.co_ban = dbo.saBanco.co_ban INNER JOIN
                         dbo.saVendedor ON cd.co_ven = dbo.saVendedor.co_ven
        WHERE
            co_cheq_dev = @sCo_Cheq_Dev
			)
	 ELSE --Automático
	(
        SELECT
			DISTINCT
            ( cd.co_cheq_dev ), cd.*, dbo.saCobroTPReng.cob_num, saCaja_1.cod_caja,
            saBanco.des_ban AS des_ban, 
            dbo.saCobroTPReng.cob_num AS num_doc, dbo.saCobroTPReng.devuelto AS devuelto,
            dbo.saMovimientoCaja.tasa AS tasa, dbo.saMovimientoCaja.co_cta_ingr_egr AS cta_Egre,
            saCaja_1.descrip AS des_cta, saCaja_1.co_mone AS co_mone, dbo.saCobroTPReng.mov_num_b, cd.automatico, saCliente.co_cta_ingr_egr as cod_cta
        FROM            dbo.saChequeDevueltoVenta AS cd INNER JOIN
                         dbo.saCliente ON dbo.saCliente.co_cli = cd.co_cli INNER JOIN
                         dbo.saCobro ON cd.co_cli = dbo.saCobro.co_cli INNER JOIN
                         dbo.saCobroTPReng ON dbo.saCobroTPReng.cob_num = dbo.saCobro.cob_num AND dbo.saCobroTPReng.num_doc = cd.num_doc AND 
                         dbo.saCobroTPReng.forma_pag = 'CH' INNER JOIN
                         dbo.saMovimientoCaja ON dbo.saCobroTPReng.mov_num_c = dbo.saMovimientoCaja.mov_num INNER JOIN
                         dbo.saCaja AS s
```
