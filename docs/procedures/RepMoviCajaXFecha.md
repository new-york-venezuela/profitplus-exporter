# SP: RepMoviCajaXFecha
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
-- Description:	<Movimientos de Cajas por Fecha>
-- =============================================
CREATE PROCEDURE [RepMoviCajaXFecha]
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @cCo_CodCaja_d CHAR(6) = NULL ,
    @cCo_CodCaja_h CHAR(6) = NULL ,
    @cCo_CuentaIngr_d CHAR(20) = NULL ,
    @cCo_CuentaIngr_h CHAR(20) = NULL ,
    @sFecha_d SMALLDATETIME = NULL ,
    @sFecha_h SMALLDATETIME = NULL ,
    @cTipoMovi CHAR(6) = NULL ,
    @cDepositado CHAR(6) = NULL ,
    @cOrigenMovi CHAR(6) = NULL ,
    @cFormaPago CHAR(6) = NULL ,
    @cMoneda CHAR(6) = NULL ,
    @cCajaInact CHAR(6) = NULL ,
    @cCondicion CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
    -- Insert statements for procedure here

/****Valores por defecto****/

        IF ( @cFormaPago IS NULL ) 
            SET @cFormaPago = 'TODO'

        IF ( @cDepositado IS NULL ) 
            SET @cDepositado = 'TODO'

        IF ( @cTipoMovi IS NULL ) 
            SET @cTipoMovi = 'TODO'

        IF ( @cOrigenMovi IS NULL ) 
            SET @cOrigenMovi = 'TODO'

        IF ( @cCajaInact IS NULL ) 
            SET @cCajaInact = 'TODO'

        IF ( @cCondicion IS NULL ) 
            SET @cCondicion = 'TODO'
/****Valores por defecto****/

        SELECT
            CA.co_mone, CA.descrip AS Des_Caja, MO.mone_des, @cCondicion AS Filtro_anulado, MC.*
        FROM
            saMovimientoCaja AS MC
            INNER JOIN saCaja AS CA ON CA.cod_caja = MC.cod_caja
            INNER JOIN saMoneda AS MO ON MO.co_mone = CA.co_mone
        WHERE
            ( ( @cCo_Numero_d IS NULL
                OR MC.mov_num >= @cCo_Numero_d
              )
              AND ( @cCo_Numero_h IS NULL
                    OR MC.mov_num <= @cCo_Numero_h
                  )
            )
            AND ( ( @cCo_CodCaja_d IS NULL
                    OR MC.cod_caja >= @cCo_CodCaja_d
                  )
                  AND ( @cCo_CodCaja_h IS NULL
                        OR MC.cod_caja <= @cCo_CodCaja_h
                      )
                )
            AND ( ( @cCo_CuentaIngr_d IS NULL
                    OR MC.co_cta_ingr_egr >=
```
