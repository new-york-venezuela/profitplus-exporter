# SP: RepCamposAdicionales
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saAdiCampo`](../tables/saAdiCampo.md)
- [`saAdiGrupo`](../tables/saAdiGrupo.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[RepCamposAdicionales]
@bHeaderRep bit = 0,
@sCampOrderBy VARCHAR(16) = NULL ,
@GrupoImpresora VARCHAR (16) = NULL, 
@CodigoImpresora_d CHAR (8) = NULL,
@CodigoImpresora_h CHAR (8) =  NULL,
@GrupoImpresora_d CHAR (8) = NULL,
@GrupoImpresora_h CHAR (8) = NULL

AS 
    BEGIN
        SET NOCOUNT ON ;
	
		declare @DirFis as nvarchar(254)
		declare @Telef as nvarchar(254)


		select @DirFis=val_str from saAdiCampo where co_adicampo = 'dir_fis'
		select @Telef=val_str from saAdiCampo where co_adicampo ='telef'

	SELECT
	 AC.co_adigrupo, AC.co_adicampo, AC.des_adicampo, AC.val_str, AC.campo1, AC.campo2, AC.campo3, AG.des_adigrupo,
	 @DirFis as direccion ,@Telef as TelefonoEmpre,


  	 CASE AC.tipo

       WHEN 1 THEN 'Caracter'
       WHEN 2 THEN 'Fecha'
       WHEN 3 THEN 'Númerico'
       WHEN 4 THEN 'Entero'
       ELSE CAST(AC.tipo AS VARCHAR)

       END AS tipo
 
	FROM 
	 saAdiCampo AS AC

	 INNER JOIN saAdiGrupo AS AG ON ac.co_adigrupo =  AG.co_adigrupo 

    WHERE
        ( 
           (@CodigoImpresora_d IS NULL OR AC.co_adicampo >= @CodigoImpresora_d)
           AND (@CodigoImpresora_h IS NULL OR AC.co_adicampo <= @CodigoImpresora_h)
        )
        AND
        ( 
           (@GrupoImpresora_d IS NULL OR AC.co_adigrupo >= @GrupoImpresora_d)
           AND (@GrupoImpresora_h IS NULL OR AC.co_adigrupo <= @GrupoImpresora_h)
        )

    ORDER BY
        CASE 
            WHEN @sCampOrderBy = 'co_adigrupo' THEN AC.co_adigrupo
            WHEN @sCampOrderBy = 'co_adicampo' THEN AC.co_adicampo
            ELSE AC.co_adigrupo

        END
END
```
