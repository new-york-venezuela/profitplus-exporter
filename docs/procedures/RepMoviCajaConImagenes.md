# SP: RepMoviCajaConImagenes
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <16/01/2015>
-- Description:	<Movimientos de Cajas por Número>
-- =============================================
CREATE PROCEDURE [dbo].[RepMoviCajaConImagenes]
	-- Add the parameters for the stored procedure here
    @sCo_Numero_d CHAR(20) = NULL ,
    @sCo_Numero_h CHAR(20) = NULL ,
    @sCo_CodCaja_d CHAR(6) = NULL ,
    @sCo_CodCaja_h CHAR(6) = NULL ,
    @sCo_CuentaIngr_d CHAR(20) = NULL ,
    @sCo_CuentaIngr_h CHAR(20) = NULL ,
	@sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sTipoMovi CHAR(6) = NULL ,        
    @sMoneda CHAR(6) = NULL ,    
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
     

        IF ( @sTipoMovi IS NULL ) 
            SET @sTipoMovi = 'TODO'

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
			  DI.co_imag, DI.des_imag, DI.picture, TI.co_tipo_imag, TI.descrip as descripImagen

        FROM
            saMovimientoCaja AS MC
            INNER JOIN saCaja AS CA ON CA.cod_caja = MC.cod_caja
            INNER JOIN saMoneda AS MO ON MO.co_mone = CA.co_mone
			left outer join saDocumentoImagen DI 
			inner join saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag ON MC.rowguid = DI.rowguidDoc
        WHERE
			DI.co_imag is not null and
            ( ( @sCo_Numero_d IS NULL
                OR MC.mov_num >= @sCo_Numero_d
              )
              AND ( @sCo_Numero_h IS NULL
                    OR MC.mov_num <= @sCo_Numero_h
                  )
            )
            AND ( ( @sCo_CodCaja_d IS NULL
                    OR MC.cod_caja >= @sCo_CodCaja_d
                  )
                  AND ( @sCo_CodCaja_h IS NULL
                        OR MC.cod_caja <= @sCo_CodCaja_h
                      )
                )
```
