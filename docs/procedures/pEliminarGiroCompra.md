# SP: pEliminarGiroCompra
**Tipo**: Eliminar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saGiroCompra`](../tables/saGiroCompra.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pEliminarGiroCompra
*DESCRIPCIÓN	:	Elimina un Giro
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pEliminarGiroCompra]
    (
      @sCo_Giro_Ori CHAR(20) ,
      @tsValidador TIMESTAMP ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN
       
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
             
        DELETE FROM
            saGiroCompra
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_Giro = @sCo_Giro_Ori
            AND validador = @tsValidador

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp

             --Eliminar Imagen Giro
             If @dtFe_De IS NOT NULL AND EXISTS (SELECT rowguidDoc from saDocumentoImagen where rowguidDoc = @rowGuidOri)
                    BEGIN        
                           DECLARE @Co_ima CHAR(6)
                           DECLARE @Validador_ima TIMESTAMP
                           DECLARE @rowguid_ima UNIQUEIDENTIFIER                       
                           DECLARE contador CURSOR LOCAL FORWARD_ONLY

                           FOR
                                  SELECT
                                        DI.[co_imag], DI.[validador], DI.[rowguid]
                                  FROM
                                        saDocumentoImagen AS DI                                     
                                  WHERE
                                        DI.rowguidDoc = @rowGuidOri
                                  ORDER BY
                                        DI.Co_imag

                                  OPEN contador
                                  FETCH NEXT FROM contador  INTO @Co_ima, @Validador_ima, @rowguid_ima
                                  WHILE @@FETCH_STATUS = 0
                                        BEGIN
                                               EXEC [dbo].[pEliminarDocumentoImagen]   @gRowguidDocOri = @rowGuidOri, @sCo_ImagOri = @Co_ima,
```
