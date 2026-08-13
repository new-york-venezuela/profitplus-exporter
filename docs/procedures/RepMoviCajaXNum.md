# SP: RepMoviCajaXNum
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <28/05/2010>
-- Description:	<Movimientos de Cajas por Número>
-- =============================================
CREATE PROCEDURE [RepMoviCajaXNum]
	-- Add the parameters for the stored procedure here
    @sCo_Numero_d CHAR(20) = NULL ,
    @sCo_Numero_h CHAR(20) = NULL ,
    @sCo_CodCaja_d CHAR(6) = NULL ,
    @sCo_CodCaja_h CHAR(6) = NULL ,
    @sCo_CuentaIngr_d CHAR(20) = NULL ,
    @sCo_CuentaIngr_h CHAR(20) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sTipoMovi CHAR(6) = NULL ,
    @sDepositado CHAR(6) = NULL ,
    @sOrigenMovi CHAR(6) = NULL ,
    @sFormaPago CHAR(6) = NULL ,
    @sMoneda CHAR(6) = NULL ,
    @sCajaInact CHAR(6) = NULL ,
    @sCondicion CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
    -- Insert statements for procedure here

/****Valores por defecto****/

        IF ( @sFormaPago IS NULL ) 
            SET @sFormaPago = 'TODO'

        IF ( @sDepositado IS NULL ) 
            SET @sDepositado = 'TODO'

        IF ( @sTipoMovi IS NULL ) 
            SET @sTipoMovi = 'TODO'

        IF ( @sOrigenMovi IS NULL ) 
            SET @sOrigenMovi = 'TODO'

        IF ( @sCajaInact IS NULL ) 
            SET @sCajaInact = 'TODO'

        IF ( @sCondicion IS NULL ) 
            SET @sCondicion = 'TODO'
/****Valores por defecto****/

        SELECT
            CA.co_mone, 
			CA.descrip AS Des_Caja, 
			MO.mone_des, 
			@sCondicion AS Filtro_anulado, 
			MC.mov_num,
			MC.fecha,
			MC.cod_caja,
			MC.forma_pag,
			MC.num_pago,
			MC.monto_d,
			MC.monto_h,	
			MC.origen,
			MC.anulado,
			MC.descrip,
			MC.Campo1,
			MC.Campo2,
			MC.Campo3,
			MC.Campo4,
			MC.Campo5,
			MC.Campo6,
			MC.Campo7,
			MC.Campo8

        FROM
            saMovimientoCaja AS MC
            INNER JOIN saCaja AS CA ON CA.cod_caja = MC.cod_caja
            INNER JOIN saMoneda AS MO ON MO.co_mone = CA.co_mone
        WHERE
            ( ( @sCo_Numero_d IS NULL
                OR MC.mov_num >= @sCo_Numero_d
              )
              AND ( @sCo_Numero_h IS NULL
                    OR MC.mov_num <= @sCo_Numero_h
                  )
            )
            AND ( ( @sCo_CodCaja_d IS NULL
                    OR M
```
