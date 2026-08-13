# SP: pObtenerSerieProcesoNCF
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saConsecutivo`](../tables/saConsecutivo.md)
- [`saConsecutivoTipo`](../tables/saConsecutivoTipo.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)
- [`saSerieTipoExt`](../tables/saSerieTipoExt.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			 : pObtenerSerieProceso
*DESCRIPCIÓN	 : Optiene el codigo del consecutivo y de la serie asociada al proceso
*AUTOR			 : SOFTECH SISTEMAS
*LAST UPDATE DATE: <2019-04-11>
************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerSerieProcesoNCF]
    (
      @codigoConsecutivo VARCHAR(16) ,
      @sCo_sucur VARCHAR(6) ,
      @sCo_emp VARCHAR(20),
	  @sPunto_Emi CHAR(3) = NULL,
	  @sArea_Imp CHAR(3) = NULL
    )
AS 
    BEGIN

        SELECT
            CO.co_consecutivo, CT.des_consecutivo AS Consecutivo,
            CO.co_serie AS Serie
        FROM
            saConsecutivoTipo CT
            INNER JOIN saconsecutivo CO ON ( ( CT.Usoempresa = 1
                                            AND CO.co_emp = @sCo_emp
                                          )
                                          OR ( CT.UsoSucursal = 1
                                               AND CO.co_sucur = @sCo_sucur
                                             )
                                        )
                                        AND CT.co_consecutivo = CO.co_consecutivo
			INNER JOIN saSerie SE ON SE.co_serie = CO.co_serie
			INNER JOIN saSerieTipo ST ON ST.co_tipo_serie = SE.co_tipo_serie
			INNER JOIN saSerieTipoExt STE ON STE.rowguid_serietipo = ST.rowguid
        WHERE
            CT.co_consecutivo LIKE @codigoConsecutivo + '%'
            --AND STE.punto_emi = @sPunto_Emi
			--AND STE.area_imp = @sArea_Imp
        ORDER BY
            CO.co_consecutivo ASC
 

    END
```
