# SP: RepPagosxNumero
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <28-09-10>
-- Description:	<Pagos por su Fecha>
-- =============================================
CREATE PROCEDURE [dbo].[RepPagosxNumero]
	-- Add the parameters for the stored procedure here
    @sNum_pag_d CHAR(20) = NULL ,
    @sNum_pag_h CHAR(20) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_prov_d CHAR(16) = NULL ,
    @sCo_prov_h CHAR(16) = NULL ,
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
        SET NOCOUNT ON ;
 
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
            SET @sCondic = 1	

        IF ( @sCondic = 'NO' ) 
            SET @sCondic = 0
	
        Declare @MonedaBase char(6)
        Select @MonedaBase = g_moneda from par_emp

        if (@sCo_Moneda_Rep is null)
            set @sCo_Moneda_Rep = @MonedaBase

        SELECT
            P.cob_num, P.fecha, P.co_prov, PV.prov_des, PT.forma_pag, PT.reng_num, P.anulado, p.co_mone, PT.num_doc,
            PT.cod_caja, C.descrip, PT.cod_cta, CB.num_cta, 
			P.monto * CASE WHEN P.anulado = 1 THEN 0 ELSE 1 END AS monto, 
			PT.mont_doc * CASE WHEN P.anulado = 1 THEN 0 ELSE 1 END AS mont_doc, 
			CASE WHEN PT.cod_caja IS NULL THEN PT.cod_cta ELSE PT.cod_caja END AS cuenta, 
			CASE WHEN PT.cod_caja IS NULL THEN CB.num_cta ELSE C.descrip END AS descripcion, 
			@sSubtotal AS subtotal,
			CASE   
					WHEN @sCo_Moneda_Rep = @MonedaBase THEN 1 
					WHEN @sCo_Moneda_Rep = P.co_mone THEN P.tasa 
					ELSE [dbo].[TasaAUnaFecha](@sCo_Moneda_Rep, 0, P.fecha)  
			END AS tasa_apl,
			P.tasa as tasa_doc, P.co_mone,				
			MN.relacion as Rel_Inv, @sCo_Moneda_Rep as Mon_Rep, @sCo_m
```
