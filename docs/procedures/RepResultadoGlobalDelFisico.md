# SP: RepResultadoGlobalDelFisico
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saInventarioFisico`](../tables/saInventarioFisico.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saResInventario`](../tables/saResInventario.md)
- [`saResInventarioReng`](../tables/saResInventarioReng.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:	<22-03-11>
 Description:	<Resultado Global del Fisico>
 =============================================*/
CREATE PROCEDURE [RepResultadoGlobalDelFisico]
	-- Add the parameters for the stored procedure here
    @dCo_Fecha_d SMALLDATETIME = NULL ,
    @dCo_Fecha_h SMALLDATETIME = NULL ,
    @sCo_Alma_d CHAR(6) = NULL ,
    @sCo_Alma_h CHAR(6) = NULL ,
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
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
            F.co_invfisico, F.inicio, F.cierre, F.ajue_num, R.num_resinv, R.fecha, R.tasa, RR.total_art_teo,
            RR.total_art, RR.co_uni, A.co_art, A.art_des, M.co_mone, M.mone_des, AL.co_alma, AL.des_alma
        FROM
            sainventariofisico F
            INNER JOIN saResinventario R ON R.co_invfisico = F.co_invfisico
            INNER JOIN saResinventarioreng RR ON RR.num_resinv = R.num_resinv
            INNER JOIN saArticulo A ON RR.co_art = A.co_art
            INNER JOIN saMoneda M ON M.co_mone = R.co_mone
            INNER JOIN saAlmacen AL ON AL.co_alma = R.co_alma
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
                )
            AND ( ( @sCo_Art_d
```
