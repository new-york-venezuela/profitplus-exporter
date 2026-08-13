# SP: RepResultadoGlobalDelFisicoConImagenes
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saInventarioFisico`](../tables/saInventarioFisico.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saResInventario`](../tables/saResInventario.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:	<18-12-2014>
 Description:	<Resultado Global del Fisico Con Imagenes>
 =============================================*/
CREATE PROCEDURE [dbo].[RepResultadoGlobalDelFisicoConImagenes]
	-- Add the parameters for the stored procedure here
    @dCo_Fecha_d SMALLDATETIME = NULL ,
    @dCo_Fecha_h SMALLDATETIME = NULL ,
    @sCo_Alma_d CHAR(6) = NULL ,
    @sCo_Alma_h CHAR(6) = NULL ,
	@sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL,
    @sCo_Proc CHAR(4) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;


        IF ( @sDir IS NULL ) 
            SET @sDir = 'ASC'

        IF ( @sCampOrderBy IS NULL ) 
            SET @sCampOrderBy = 'co_alma'
		
        IF @dCo_Fecha_d IS NOT NULL 
            SET @dCo_Fecha_d = dbo.FechaSimple(@dCo_Fecha_d)
        IF @dCo_Fecha_h IS NOT NULL 
            SET @dCo_Fecha_h = dbo.FechaSimple(@dCo_Fecha_h)
	 
        IF @sCo_Proc IS NULL 
            SET @sCo_Proc = 'TODO'
	 
        DECLARE @sCo_Proc2 BIT
	 
        IF @sCo_Proc = 'SIT' 
            SET @sCo_Proc2 = 1
        IF @sCo_Proc = 'NOT' 
            SET @sCo_Proc2 = 0
	 

        SELECT
            F.co_invfisico, F.inicio, F.cierre, F.ajue_num, R.num_resinv, R.fecha, R.tasa, 
			M.co_mone, M.mone_des, AL.co_alma, AL.des_alma,
			  DI.co_imag, DI.des_imag, DI.picture, TI.co_tipo_imag, TI.descrip as descripImagen
        FROM
            sainventariofisico F
            INNER JOIN saResinventario R ON R.co_invfisico = F.co_invfisico
            INNER JOIN saMoneda M ON M.co_mone = R.co_mone
            INNER JOIN saAlmacen AL ON AL.co_alma = R.co_alma
			left outer join saDocumentoImagen DI 
			inner join saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag ON R.rowguid = DI.rowguidDoc
        WHERE
            ( ( @dCo_Fecha_d IS NULL
                OR dbo.FechaSimple(R.fecha) >= @dCo_Fecha_d
              )
              AND ( @dCo_Fecha_h IS NULL
                    OR dbo.FechaSimple(R.fecha) <= @dCo_Fecha_h
                  )
            )
            AND ( ( @sCo_Alma_d IS NULL
                    OR AL.co_alma >= @sCo_Alma_d
                  )
                  AND ( @sCo_Alma_h IS NULL
                        OR AL.co_alma <= @sCo_Alma_h
                      )
```
