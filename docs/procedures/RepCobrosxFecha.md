# SP: RepCobrosxFecha
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
- [`saMoneda`](../tables/saMoneda.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		  SOFTECH SISTEMAS
-- Create date:   <28-09-10>
-- Modified date: <2020-12-09>
-- Description:	  <Cobros por su Fecha>
-- =============================================
CREATE PROCEDURE [dbo].[RepCobrosxFecha]
	-- Add the parameters for the stored procedure here
    @sNum_pag_d CHAR(20) = NULL ,
    @sNum_pag_h CHAR(20) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @sCo_Ven_d CHAR(16) = NULL ,
    @sCo_Ven_h CHAR(16) = NULL ,
    @sCo_mone CHAR(6) = NULL ,
    @sCo_Moneda_Rep CHAR(6) = NULL ,
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
        SET NOCOUNT ON

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
            SET @sCondic = NULL
	
        IF ( @sCondic = 'SI' ) 
            SET @bCondic = 1
         

        IF ( @sCondic = 'NO' ) 
            SET @bCondic = 0
         

        Declare @MonedaBase char(6)
        Select @MonedaBase = g_moneda from par_emp

        if (@sCo_Moneda_Rep is null)
            set @sCo_Moneda_Rep = @MonedaBase
	
        SELECT
            P.cob_num,
			P.fecha,
			P.co_cli,
			P.anulado,
			p.co_mone,
			CASE WHEN P.anulado = 1 THEN 0 ELSE P.monto END AS monto,
			P.tasa as tasa_doc,
			PV.cli_des,
			PT.forma_pag,
			PT.reng_num,
			PT.cod_caja,
			PT.cod_cta,
			CASE WHEN P.anulado = 1 THEN 0 ELSE PT.mont_doc  END AS mont_doc,
			CASE WHEN PT.cod_caja IS NULL THEN PT.cod_cta ELSE PT.cod_caja END AS cuenta, 
			CASE WHEN PT.cod_caja IS NULL THEN CB.num_cta ELSE C.descrip END AS descripcion, 
			--PR.num_doc,
            C.descrip,
			CB.num_cta, 
			--TP.tipo_mov,
			MN.relacion as Rel_Inv,             
			@sSubtotal AS subtotal,
			CASE WHEN @sCo_Moneda_Rep
```
