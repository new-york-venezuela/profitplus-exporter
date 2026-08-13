# SP: RepCobrosxVendedor
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <28-09-10>
-- Description:	<Cobros por su Fecha>
-- =============================================
CREATE PROCEDURE [dbo].[RepCobrosxVendedor]
	-- Add the parameters for the stored procedure here
	
    @sNum_pag_d CHAR(20) = NULL ,
    @sNum_pag_h CHAR(20) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @sCo_Ven_d CHAR(6) = NULL ,
    @sCo_Ven_h CHAR(6) = NULL ,
    @sCo_mone CHAR(6) = NULL ,
    @sSubtotal CHAR(4) = NULL ,
    @sCo_zon_d CHAR(6) = NULL ,
    @sCo_zon_h CHAR(6) = NULL ,
    @sCo_seg_d CHAR(6) = NULL ,
    @sCo_seg_h CHAR(6) = NULL ,
    @sCondic CHAR(2) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

DECLARE @bCondic BIT
 
        IF @dFecha_d IS NOT NULL 
            SET @dFecha_d = dbo.FechaSimple(@dFecha_d)
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = dbo.FechaSimple(@dFecha_h)

		
        IF @sSubtotal = 'Si'
            OR @sSubtotal IS NULL 
            SET @sSubtotal = 'Si'
        ELSE 
            SET @sSubtotal = 'No'

         IF ( @sCondic = 'TD' ) 
            SET @bCondic = NULL
	
        IF ( @sCondic = 'SI' ) 
            SET @bCondic = 1	

        IF ( @sCondic = 'NO' ) 
            SET @bCondic = 0
	
	

        DECLARE @mone_base AS CHAR(2) 
        SELECT
            @mone_base = g_moneda
        FROM
            par_emp
	
        SELECT
            P.cob_num, P.fecha, P.co_cli, PV.cli_des, PT.forma_pag, V.co_ven, V.ven_des, PT.reng_num, P.anulado,
            p.co_mone, PR.num_doc, PT.cod_caja, C.descrip, PT.cod_cta, CB.num_cta,
            P.monto / ( CASE WHEN @sCo_mone IS NULL THEN 1
                             ELSE P.tasa
                        END ) * CASE WHEN P.anulado = 1 THEN 0
                                     ELSE 1
                                END AS monto, PT.mont_doc / ( CASE WHEN @sCo_mone IS NULL THEN 1
                                                                   ELSE P.tasa
                                                              END ) * CASE WHEN P.anulado = 1 THEN 0
                                                                           ELSE 1
```
